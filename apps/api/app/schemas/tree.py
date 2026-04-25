from datetime import datetime

from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas.learning import LessonPackage, MasteryEvidence, QuizAnswerSubmission, QuizFeedback, QuizQuestion


SUPPORTED_AGE_BANDS = {
    "early-reader",
    "elementary",
    "middle-school",
    "high-school",
    "higher-ed",
    "college",
    "research",
    "phd",
}


class ProfileCreate(BaseModel):
    display_name: str = Field(min_length=1, max_length=100)
    avatar_seed: str | None = None
    age_band: str | None = None

    @field_validator("display_name")
    @classmethod
    def validate_display_name(cls, value: str) -> str:
        cleaned = " ".join(value.strip().split())
        if not cleaned:
            raise ValueError("Profile name must not be blank.")
        return cleaned

    @field_validator("avatar_seed")
    @classmethod
    def validate_avatar_seed(cls, value: str | None) -> str | None:
        if value is None:
            return None

        cleaned = " ".join(value.strip().split())
        return cleaned or None

    @field_validator("age_band")
    @classmethod
    def validate_age_band(cls, value: str | None) -> str | None:
        if value is None:
            return None

        cleaned = value.strip().lower()
        if not cleaned:
            return None
        if cleaned not in SUPPORTED_AGE_BANDS:
            raise ValueError(f"Age band must be one of: {', '.join(sorted(SUPPORTED_AGE_BANDS))}.")
        return cleaned


class ProfileRead(BaseModel):
    id: int
    display_name: str
    avatar_seed: str | None = None
    age_band: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ProfileSummaryRead(BaseModel):
    id: int
    display_name: str
    avatar_seed: str | None = None
    age_band: str | None = None

    model_config = {"from_attributes": True}


class LeafNodeRead(BaseModel):
    id: int
    title: str
    subtopic_key: str
    description: str | None = None
    leaf_x: float
    leaf_y: float
    render_radius: float
    hit_radius: float
    mastery_level: int = 0


class BranchRead(BaseModel):
    id: int
    subject_key: str
    title: str
    color_hex: str
    anchor_x: float
    anchor_y: float
    canopy_width: float
    canopy_height: float
    leaves: list[LeafNodeRead]


class GradeRead(BaseModel):
    id: int
    grade_code: str
    title: str
    sort_order: int
    branches: list[BranchRead]


class TreeSnapshotRead(BaseModel):
    profile_id: int | None
    grades: list[GradeRead]


class LessonStreamRequest(BaseModel):
    profile_id: int = Field(gt=0)
    leaf_id: int = Field(gt=0)


class LessonCompletionRequest(BaseModel):
    profile_id: int = Field(gt=0)
    correct_count: int | None = Field(default=None, ge=0)
    question_count: int | None = Field(default=None, gt=0)
    answers: list[QuizAnswerSubmission] | None = None

    @model_validator(mode="after")
    def validate_completion_payload(self) -> "LessonCompletionRequest":
        has_legacy_score = self.correct_count is not None or self.question_count is not None
        has_answers = self.answers is not None
        if not has_answers and not has_legacy_score:
            raise ValueError("Provide quiz answers or a legacy score.")
        if has_legacy_score and (self.correct_count is None or self.question_count is None):
            raise ValueError("Legacy completion requires correct_count and question_count.")
        if self.correct_count is not None and self.question_count is not None and self.correct_count > self.question_count:
            raise ValueError("Correct count cannot exceed question count.")
        return self


class LeafGenerationRequest(BaseModel):
    grade: str = Field(min_length=1, max_length=50)
    subject: str = Field(min_length=1, max_length=80)
    count: int = Field(default=3, ge=1, le=6)

    @field_validator("grade", "subject")
    @classmethod
    def validate_lookup_text(cls, value: str) -> str:
        cleaned = " ".join(value.strip().split())
        if not cleaned:
            raise ValueError("Lookup text must not be blank.")
        return cleaned


class GeneratedLeafRead(BaseModel):
    id: int
    title: str
    subtopic_key: str
    description: str | None = None
    leaf_x: float
    leaf_y: float
    render_radius: float
    hit_radius: float


class LeafGenerationResponse(BaseModel):
    grade: str
    subject: str
    generated_count: int
    leaves: list[GeneratedLeafRead]


class LessonHistoryItemRead(BaseModel):
    id: int
    leaf_id: int
    leaf_title: str
    subject_title: str
    grade_title: str
    title: str
    content: str
    vocabulary_words: list[str] = Field(min_length=5, max_length=5)
    is_completed: bool = False
    challenge_score: int | None = None
    challenge_total: int | None = None
    completed_at: datetime | None = None
    created_at: datetime
    recovered: bool = False
    recovery_detail: str | None = None
    stream_model: str | None = None
    lesson_package: LessonPackage | None = None
    quiz: list[QuizQuestion] | None = None
    mastery_evidence: MasteryEvidence | None = None
    curriculum_spec_id: str | None = None
    generation_quality: str | None = None


class LessonHistoryRead(BaseModel):
    profile_id: int
    lessons: list[LessonHistoryItemRead]


class LessonCompletionResponse(BaseModel):
    lesson: LessonHistoryItemRead
    mastery_level: int
    lessons_completed: int
    completed_now: bool
    score: int
    total: int
    passed: bool
    passing_score: int
    feedback: list[QuizFeedback] = []
