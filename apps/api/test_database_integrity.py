from sqlalchemy import text
from sqlalchemy.orm import sessionmaker

from app.db.base import Base
from app.db.bootstrap import apply_migrations
from app.db.models import GradeLevel, Leaf, Lesson, Profile, ProfileLeafProgress, SubjectBranch
from app.db.session import build_engine


def test_sqlite_foreign_keys_cascade_and_set_null(tmp_path):
    database_path = tmp_path / "foreign_keys.db"
    engine = build_engine(f"sqlite:///{database_path.as_posix()}")
    testing_session_local = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    Base.metadata.create_all(bind=engine)
    with testing_session_local() as session:
        apply_migrations(session)
        assert session.execute(text("PRAGMA foreign_keys")).scalar_one() == 1

        profile = Profile(display_name="Explorer")
        grade = GradeLevel(grade_code="test-grade", title="Test Grade", sort_order=1000)
        branch = SubjectBranch(
            grade_level=grade,
            subject_key="math",
            title="Math",
            color_hex="#8CCB5E",
            sort_order=0,
            anchor_x=0.0,
            anchor_y=0.0,
            canopy_width=100.0,
            canopy_height=100.0,
        )
        leaf = Leaf(
            branch=branch,
            subtopic_key="counting",
            title="Counting",
            leaf_x=0.0,
            leaf_y=0.0,
            render_radius=28.0,
            hit_radius=56.0,
        )
        lesson = Lesson(
            profile=profile,
            leaf=leaf,
            lesson_title="Counting",
            body_text="Count leaves.",
            vocabulary_words_json='["counting","numbers","practice","example","pattern"]',
            raw_payload_json='{"model":"test-model"}',
        )
        session.add_all([profile, grade, branch, leaf, lesson])
        session.commit()

        progress = ProfileLeafProgress(
            profile_id=profile.id,
            leaf_id=leaf.id,
            last_lesson_id=lesson.id,
            mastery_level=1,
            lessons_completed=1,
        )
        session.add(progress)
        session.commit()
        progress_id = progress.id

        session.execute(text("DELETE FROM lessons WHERE id = :lesson_id"), {"lesson_id": lesson.id})
        session.commit()
        assert session.get(ProfileLeafProgress, progress_id).last_lesson_id is None

        session.execute(text("DELETE FROM profiles WHERE id = :profile_id"), {"profile_id": profile.id})
        session.commit()
        assert session.get(ProfileLeafProgress, progress_id) is None

    engine.dispose()


def test_migrations_are_recorded(tmp_path):
    database_path = tmp_path / "migrations.db"
    engine = build_engine(f"sqlite:///{database_path.as_posix()}")
    testing_session_local = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    Base.metadata.create_all(bind=engine)
    with testing_session_local() as session:
        apply_migrations(session)
        session.commit()

        migration_ids = {
            row[0]
            for row in session.execute(text("SELECT id FROM schema_migrations")).all()
        }
        assert "20260424_0001_lesson_completion_state" in migration_ids

    engine.dispose()
