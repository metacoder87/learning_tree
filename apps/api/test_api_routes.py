import json

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from app.db.base import Base
from app.db.bootstrap import apply_migrations, seed_grade_levels, seed_leaves, seed_subject_branches
from app.db.models import Lesson
from app.db.session import build_engine, get_db
from app.main import app
from app.services.curriculum import build_lesson_package, find_curriculum_spec


@pytest.fixture()
def isolated_app(tmp_path):
    database_path = tmp_path / "learning_tree_test.db"
    engine = build_engine(f"sqlite:///{database_path.as_posix()}")
    testing_session_local = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    Base.metadata.create_all(bind=engine)
    with testing_session_local() as session:
        apply_migrations(session)
        seed_grade_levels(session)
        seed_subject_branches(session)
        seed_leaves(session)
        session.commit()

    def override_get_db():
        db = testing_session_local()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as client:
        yield client, testing_session_local

    app.dependency_overrides.clear()
    engine.dispose()


def test_create_profile_trims_name_and_rejects_blank(isolated_app):
    client, _session_factory = isolated_app

    blank_response = client.post("/api/profiles", json={"display_name": "   "})
    assert blank_response.status_code == 422

    response = client.post(
        "/api/profiles",
        json={"display_name": "  Ada   Tree  ", "age_band": "elementary"},
    )
    assert response.status_code == 201
    assert response.json()["display_name"] == "Ada Tree"


def test_tree_requires_existing_profile(isolated_app):
    client, _session_factory = isolated_app

    response = client.get("/api/tree?profile_id=99999")
    assert response.status_code == 404
    assert response.json()["detail"] == "Profile not found"


def test_lesson_history_exposes_recovery_metadata(isolated_app):
    client, session_factory = isolated_app

    profile_id = client.post("/api/profiles", json={"display_name": "Explorer"}).json()["id"]
    tree = client.get(f"/api/tree?profile_id={profile_id}").json()
    leaf_id = tree["grades"][0]["branches"][0]["leaves"][0]["id"]

    with session_factory() as session:
        lesson = Lesson(
            profile_id=profile_id,
            leaf_id=leaf_id,
            lesson_title="Fallback Counting",
            body_text="## Story Start\nA fallback lesson appeared.",
            vocabulary_words_json=json.dumps(["counting", "numbers", "practice", "example", "pattern"]),
            raw_payload_json=json.dumps(
                {
                    "model": "test-model",
                    "recovered": True,
                    "recovery_detail": "Ollama connection failed",
                }
            ),
        )
        session.add(lesson)
        session.commit()

    response = client.get(f"/api/profiles/{profile_id}/lessons")
    assert response.status_code == 200
    payload = response.json()["lessons"][0]
    assert payload["recovered"] is True
    assert payload["recovery_detail"] == "Ollama connection failed"
    assert payload["stream_model"] == "test-model"


def test_lesson_completion_is_idempotent(isolated_app):
    client, session_factory = isolated_app

    profile_id = client.post("/api/profiles", json={"display_name": "Explorer"}).json()["id"]
    tree = client.get(f"/api/tree?profile_id={profile_id}").json()
    leaf_id = tree["grades"][0]["branches"][0]["leaves"][0]["id"]

    with session_factory() as session:
        lesson = Lesson(
            profile_id=profile_id,
            leaf_id=leaf_id,
            lesson_title="Counting",
            body_text="## Story Start\nCount one leaf. Count another leaf.",
            vocabulary_words_json=json.dumps(["counting", "numbers", "practice", "example", "pattern"]),
            raw_payload_json=json.dumps({"model": "test-model", "recovered": False}),
        )
        session.add(lesson)
        session.commit()
        lesson_id = lesson.id

    first_response = client.post(
        f"/api/lessons/{lesson_id}/complete",
        json={"profile_id": profile_id, "correct_count": 3, "question_count": 3},
    )
    assert first_response.status_code == 200
    assert first_response.json()["completed_now"] is True
    assert first_response.json()["mastery_level"] == 1
    assert first_response.json()["lessons_completed"] == 1

    second_response = client.post(
        f"/api/lessons/{lesson_id}/complete",
        json={"profile_id": profile_id, "correct_count": 2, "question_count": 3},
    )
    assert second_response.status_code == 200
    assert second_response.json()["completed_now"] is False
    assert second_response.json()["mastery_level"] == 1
    assert second_response.json()["lessons_completed"] == 1


def test_structured_lesson_completion_scores_backend_quiz(isolated_app):
    client, session_factory = isolated_app

    profile_id = client.post("/api/profiles", json={"display_name": "Explorer"}).json()["id"]
    tree = client.get(f"/api/tree?profile_id={profile_id}").json()
    grade_six = next(grade for grade in tree["grades"] if grade["grade_code"] == "grade-6")
    math_branch = next(branch for branch in grade_six["branches"] if branch["subject_key"] == "math")
    ratios_leaf = next(leaf for leaf in math_branch["leaves"] if leaf["subtopic_key"] == "ratios")

    class Context:
        grade_code = "grade-6"
        grade_title = "Grade 6"
        grade_sort_order = 7
        subject_key = "math"
        subject_title = "Math"
        subtopic_key = "ratios"
        leaf_title = "Ratios"

    spec = find_curriculum_spec(Context)
    assert spec is not None
    package = build_lesson_package(context=Context, spec=spec, generation_quality="local_validated")

    with session_factory() as session:
        lesson = Lesson(
            profile_id=profile_id,
            leaf_id=ratios_leaf["id"],
            lesson_title="Ratios",
            body_text="Structured ratios lesson.",
            vocabulary_words_json=json.dumps(["ratio", "equivalent", "factor", "table", "rate"]),
            raw_payload_json=json.dumps(
                {
                    "model": "test-model",
                    "lesson_package": package.model_dump(mode="json"),
                    "quiz": [question.model_dump(mode="json") for question in package.quiz],
                    "mastery_evidence": package.mastery_evidence.model_dump(mode="json"),
                    "curriculum_spec_id": package.curriculum_spec_id,
                    "generation_quality": package.generation_quality,
                }
            ),
        )
        session.add(lesson)
        session.commit()
        lesson_id = lesson.id

    response = client.post(
        f"/api/lessons/{lesson_id}/complete",
        json={
            "profile_id": profile_id,
            "answers": [
                {"question_id": "q1", "value": "2:1"},
                {"question_id": "q2", "value": "2:3"},
                {
                    "question_id": "q3",
                    "value": [
                        "read the ratio order",
                        "choose the same factor",
                        "multiply or divide both parts",
                        "check the comparison still matches",
                    ],
                },
                {
                    "question_id": "q4",
                    "value": {
                        "multiply both parts by 3": "ratio reasoning",
                        "add 3 to both parts": "not ratio reasoning",
                        "keep blue-to-green order": "ratio reasoning",
                        "swap green and blue without saying so": "not ratio reasoning",
                    },
                },
                {"question_id": "q5", "value": "multiply both parts by 2"},
            ],
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["passed"] is True
    assert payload["score"] == 5
    assert payload["completed_now"] is True
    assert payload["lesson"]["curriculum_spec_id"] == "grade-6-math-ratios-v1"

    second_response = client.post(
        f"/api/lessons/{lesson_id}/complete",
        json={
            "profile_id": profile_id,
            "answers": [
                {"question_id": "q1", "value": "wrong"},
                {"question_id": "q2", "value": "wrong"},
                {"question_id": "q3", "value": ["wrong", "wrong", "wrong", "wrong"]},
                {"question_id": "q4", "value": {}},
                {"question_id": "q5", "value": "wrong"},
            ],
        },
    )
    assert second_response.status_code == 200
    assert second_response.json()["completed_now"] is False
    assert second_response.json()["lessons_completed"] == 1
    assert second_response.json()["lesson"]["challenge_score"] == 5
