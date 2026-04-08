from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Profile(Base):
    __tablename__ = "profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    avatar_seed: Mapped[str | None] = mapped_column(String(100), nullable=True)
    age_band: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.current_timestamp(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp(),
        nullable=False,
    )

    lessons: Mapped[list["Lesson"]] = relationship(back_populates="profile", cascade="all, delete-orphan")
    progress_rows: Mapped[list["ProfileLeafProgress"]] = relationship(back_populates="profile", cascade="all, delete-orphan")


class GradeLevel(Base):
    __tablename__ = "grade_levels"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    grade_code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    title: Mapped[str] = mapped_column(String(50), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, unique=True, nullable=False)

    branches: Mapped[list["SubjectBranch"]] = relationship(back_populates="grade_level", cascade="all, delete-orphan")


class SubjectBranch(Base):
    __tablename__ = "subject_branches"
    __table_args__ = (UniqueConstraint("grade_level_id", "subject_key", name="uq_branch_grade_subject"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    grade_level_id: Mapped[int] = mapped_column(ForeignKey("grade_levels.id", ondelete="CASCADE"), nullable=False)
    subject_key: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(80), nullable=False)
    color_hex: Mapped[str] = mapped_column(String(7), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False)
    anchor_x: Mapped[float] = mapped_column(Float, nullable=False)
    anchor_y: Mapped[float] = mapped_column(Float, nullable=False)
    canopy_width: Mapped[float] = mapped_column(Float, nullable=False)
    canopy_height: Mapped[float] = mapped_column(Float, nullable=False)
    path_points_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    grade_level: Mapped["GradeLevel"] = relationship(back_populates="branches")
    leaves: Mapped[list["Leaf"]] = relationship(back_populates="branch", cascade="all, delete-orphan")


class Leaf(Base):
    __tablename__ = "leaves"
    __table_args__ = (
        UniqueConstraint("branch_id", "subtopic_key", name="uq_leaf_branch_subtopic"),
        CheckConstraint("render_radius > 0", name="ck_leaf_render_radius_positive"),
        CheckConstraint("hit_radius >= render_radius", name="ck_leaf_hit_radius_gte_render_radius"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    branch_id: Mapped[int] = mapped_column(ForeignKey("subject_branches.id", ondelete="CASCADE"), nullable=False)
    subtopic_key: Mapped[str] = mapped_column(String(80), nullable=False)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    lesson_seed_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    leaf_x: Mapped[float] = mapped_column(Float, nullable=False)
    leaf_y: Mapped[float] = mapped_column(Float, nullable=False)
    render_radius: Mapped[float] = mapped_column(Float, nullable=False, default=24.0)
    hit_radius: Mapped[float] = mapped_column(Float, nullable=False, default=48.0)
    unlock_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="1")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.current_timestamp(), nullable=False)

    branch: Mapped["SubjectBranch"] = relationship(back_populates="leaves")
    lessons: Mapped[list["Lesson"]] = relationship(back_populates="leaf", cascade="all, delete-orphan")
    progress_rows: Mapped[list["ProfileLeafProgress"]] = relationship(back_populates="leaf", cascade="all, delete-orphan")


class Lesson(Base):
    __tablename__ = "lessons"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    profile_id: Mapped[int] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)
    leaf_id: Mapped[int] = mapped_column(ForeignKey("leaves.id", ondelete="CASCADE"), nullable=False)
    lesson_title: Mapped[str] = mapped_column(String(200), nullable=False)
    body_text: Mapped[str] = mapped_column(Text, nullable=False)
    vocabulary_words_json: Mapped[str] = mapped_column(Text, nullable=False)
    raw_payload_json: Mapped[str] = mapped_column(Text, nullable=False)
    is_completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="0")
    challenge_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    challenge_total: Mapped[int | None] = mapped_column(Integer, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.current_timestamp(), nullable=False)

    profile: Mapped["Profile"] = relationship(back_populates="lessons")
    leaf: Mapped["Leaf"] = relationship(back_populates="lessons")
    progress_rows: Mapped[list["ProfileLeafProgress"]] = relationship(back_populates="last_lesson")


class ProfileLeafProgress(Base):
    __tablename__ = "profile_leaf_progress"
    __table_args__ = (
        UniqueConstraint("profile_id", "leaf_id", name="uq_profile_leaf_progress"),
        CheckConstraint("mastery_level >= 0", name="ck_mastery_non_negative"),
        CheckConstraint("lessons_completed >= 0", name="ck_lessons_completed_non_negative"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    profile_id: Mapped[int] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)
    leaf_id: Mapped[int] = mapped_column(ForeignKey("leaves.id", ondelete="CASCADE"), nullable=False)
    mastery_level: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    lessons_completed: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    last_lesson_id: Mapped[int | None] = mapped_column(ForeignKey("lessons.id", ondelete="SET NULL"), nullable=True)
    last_opened_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    profile: Mapped["Profile"] = relationship(back_populates="progress_rows")
    leaf: Mapped["Leaf"] = relationship(back_populates="progress_rows")
    last_lesson: Mapped["Lesson | None"] = relationship(back_populates="progress_rows")
