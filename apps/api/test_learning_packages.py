from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from app.schemas.learning import LessonPackage, QuizAnswerSubmission, QuizQuestion, score_quiz_answers
from app.services.curriculum import (
    CURRICULUM_SPECS,
    build_lesson_package,
    fallback_curriculum_spec,
    find_curriculum_spec,
)


def context(**overrides):
    values = {
        "grade_code": "grade-6",
        "grade_title": "Grade 6",
        "grade_sort_order": 7,
        "subject_key": "math",
        "subject_title": "Math",
        "subtopic_key": "ratios",
        "leaf_title": "Ratios",
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def test_curriculum_spec_lookup_by_grade_subject_and_leaf():
    spec = find_curriculum_spec(context())

    assert spec is not None
    assert spec.id == "grade-6-math-ratios-v1"
    assert spec.objective.startswith("Use ratio language")


def test_lesson_package_validation_accepts_vertical_slice_spec():
    spec = find_curriculum_spec(context())
    assert spec is not None

    package = build_lesson_package(context=context(), spec=spec, generation_quality="local_validated")

    assert package.curriculum_spec_id == spec.id
    assert [section.kind for section in package.sections][:3] == ["objective", "hook", "direct-teaching"]
    assert len(package.quiz) == 5


@pytest.mark.parametrize(
    ("grade_code", "grade_title", "grade_sort_order", "subject_key", "subject_title", "subtopic_key", "leaf_title", "quiz_count"),
    [
        ("grade-6", "Grade 6", 7, "math", "Math", "negative-numbers", "Negative Numbers", 5),
        ("grade-6", "Grade 6", 7, "math", "Math", "expressions", "Expressions", 5),
        ("grade-3", "Grade 3", 4, "science", "Science", "forces", "Forces", 4),
        ("grade-3", "Grade 3", 4, "science", "Science", "ecosystems", "Ecosystems", 4),
    ],
)
def test_requested_curriculum_slices_build_valid_packages(
    grade_code,
    grade_title,
    grade_sort_order,
    subject_key,
    subject_title,
    subtopic_key,
    leaf_title,
    quiz_count,
):
    lesson_context = context(
        grade_code=grade_code,
        grade_title=grade_title,
        grade_sort_order=grade_sort_order,
        subject_key=subject_key,
        subject_title=subject_title,
        subtopic_key=subtopic_key,
        leaf_title=leaf_title,
    )
    spec = find_curriculum_spec(lesson_context)

    assert spec is not None
    package = build_lesson_package(context=lesson_context, spec=spec, generation_quality="local_validated")

    assert package.curriculum_spec_id == spec.id
    assert len(package.quiz) == quiz_count
    assert package.objective == spec.objective


def test_lesson_package_validation_rejects_generic_filler():
    spec = CURRICULUM_SPECS[0]
    package = build_lesson_package(
        context=context(grade_code=spec.grade_code, grade_title="Pre-K", grade_sort_order=0, subject_key=spec.subject_key, subject_title="Math", subtopic_key=spec.subtopic_key, leaf_title="Counting to 5"),
        spec=spec,
        generation_quality="local_validated",
    )
    payload = package.model_dump()
    payload["sections"][1]["body"] = "This topic is important because learning is fun and there are many things to know."

    with pytest.raises(ValidationError):
        LessonPackage.model_validate(payload)


def test_quiz_validation_rejects_duplicate_choices_and_missing_correct_answer():
    with pytest.raises(ValidationError):
        QuizQuestion.model_validate(
            {
                "id": "bad",
                "type": "multiple-choice",
                "prompt": "Which answer is valid for this lesson?",
                "choices": [
                    {"id": "a", "label": "same", "is_correct": False},
                    {"id": "b", "label": "same", "is_correct": False},
                ],
                "categories": [],
                "answer_key": None,
                "explanation": "The explanation exists but the choices are malformed.",
                "lesson_reference": "Direct Teaching",
            }
        )


def test_fallback_curriculum_package_is_valid_for_non_upgraded_leaf():
    fallback_spec = fallback_curriculum_spec(
        context(
            grade_code="grade-5",
            grade_title="Grade 5",
            grade_sort_order=6,
            subject_key="science",
            subject_title="Science",
            subtopic_key="water-cycle-extra",
            leaf_title="Water Cycle Extra",
        )
    )

    package = build_lesson_package(
        context=context(
            grade_code="grade-5",
            grade_title="Grade 5",
            grade_sort_order=6,
            subject_key="science",
            subject_title="Science",
            subtopic_key="water-cycle-extra",
            leaf_title="Water Cycle Extra",
        ),
        spec=fallback_spec,
        generation_quality="legacy_review",
    )

    assert package.generation_quality == "legacy_review"
    assert len(package.quiz) == 4


def test_backend_quiz_scoring_uses_answer_keys():
    spec = find_curriculum_spec(context())
    assert spec is not None
    package = build_lesson_package(context=context(), spec=spec, generation_quality="local_validated")

    result = score_quiz_answers(
        tier=package.tier,
        quiz=package.quiz,
        submissions=[
            QuizAnswerSubmission(question_id="q1", value="2:1"),
            QuizAnswerSubmission(question_id="q2", value="2:3"),
            QuizAnswerSubmission(
                question_id="q3",
                value=[
                    "read the ratio order",
                    "choose the same factor",
                    "multiply or divide both parts",
                    "check the comparison still matches",
                ],
            ),
            QuizAnswerSubmission(
                question_id="q4",
                value={
                    "multiply both parts by 3": "ratio reasoning",
                    "add 3 to both parts": "not ratio reasoning",
                    "keep blue-to-green order": "ratio reasoning",
                    "swap green and blue without saying so": "not ratio reasoning",
                },
            ),
            QuizAnswerSubmission(question_id="q5", value="multiply both parts by 2"),
        ],
    )

    assert result.passed is True
    assert result.correct_count == 5
