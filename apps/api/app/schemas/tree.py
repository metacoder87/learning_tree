from datetime import datetime

from pydantic import BaseModel, Field


class ProfileCreate(BaseModel):
    display_name: str = Field(min_length=1, max_length=100)
    avatar_seed: str | None = None
    age_band: str | None = None


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
    profile_id: int
    leaf_id: int


class LessonCompletionRequest(BaseModel):
    profile_id: int
    correct_count: int = Field(ge=0)
    question_count: int = Field(gt=0)


class LeafGenerationRequest(BaseModel):
    grade: str = Field(min_length=1, max_length=50)
    subject: str = Field(min_length=1, max_length=80)
    count: int = Field(default=3, ge=1, le=6)


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


class LessonHistoryRead(BaseModel):
    profile_id: int
    lessons: list[LessonHistoryItemRead]


class LessonCompletionResponse(BaseModel):
    lesson: LessonHistoryItemRead
    mastery_level: int
    lessons_completed: int
    completed_now: bool
