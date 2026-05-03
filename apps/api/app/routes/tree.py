import json
import re
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.db.models import GradeLevel, Leaf, Lesson, Profile, ProfileLeafProgress, SubjectBranch
from app.db.session import SessionLocal, get_db
from app.schemas.tree import (
    BranchRead,
    GeneratedLeafRead,
    GradeRead,
    LeafGenerationRequest,
    LeafGenerationResponse,
    LessonCompletionRequest,
    LessonCompletionResponse,
    LessonHistoryItemRead,
    LessonHistoryRead,
    LessonStreamRequest,
    ProfileCreate,
    ProfileRead,
    ProfileSummaryRead,
    TreeSnapshotRead,
)
from app.schemas.learning import (
    LessonPackage,
    MasteryEvidence,
    QuizFeedback,
    QuizQuestion,
    QuizScoreResult,
    passing_score_for_tier,
    score_quiz_answers,
)
from app.services.ai_health import check_ai_health
from app.services.curriculum import tier_for_grade_sort_order
from app.services.lesson_engine import (
    GeneratedLesson,
    LessonEngineError,
    LeafGenerationContext,
    build_generated_lesson_from_package,
    build_validated_lesson_package,
    generate_subtopics_direct,
    pick_lesson_models,
    resolve_lesson_context,
)
from app.services.tree_layout import compute_leaf_position, slugify_token


router = APIRouter(prefix="/api", tags=["tree"])


@router.get("/health")
def healthcheck():
    return {"status": "ok"}


@router.get("/health/ai")
def ai_healthcheck():
    return check_ai_health()


@router.post("/profiles", response_model=ProfileRead, status_code=status.HTTP_201_CREATED)
def create_profile(payload: ProfileCreate, db: Session = Depends(get_db)):
    profile = Profile(
        display_name=payload.display_name,
        avatar_seed=payload.avatar_seed,
        age_band=payload.age_band,
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


@router.get("/profiles", response_model=list[ProfileSummaryRead])
def list_profiles(db: Session = Depends(get_db)):
    profiles = db.execute(select(Profile).order_by(Profile.created_at, Profile.id)).scalars().all()
    return [ProfileSummaryRead.model_validate(profile) for profile in profiles]


@router.get("/tree", response_model=TreeSnapshotRead)
def read_tree(profile_id: int | None = Query(default=None, gt=0), db: Session = Depends(get_db)):
    grade_levels = (
        db.execute(
            select(GradeLevel)
            .options(selectinload(GradeLevel.branches).selectinload(SubjectBranch.leaves))
            .order_by(GradeLevel.sort_order)
        )
        .scalars()
        .all()
    )

    progress_by_leaf: dict[int, int] = {}
    if profile_id is not None:
        if db.get(Profile, profile_id) is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")

        progress_rows = (
            db.execute(
                select(ProfileLeafProgress)
                .where(ProfileLeafProgress.profile_id == profile_id)
            )
            .scalars()
            .all()
        )
        progress_by_leaf = {row.leaf_id: row.mastery_level for row in progress_rows}

    grades: list[GradeRead] = []
    for grade in grade_levels:
        branches: list[BranchRead] = []
        for branch in sorted(grade.branches, key=lambda item: item.sort_order):
            leaves = [
                {
                    "id": leaf.id,
                    "title": leaf.title,
                    "subtopic_key": leaf.subtopic_key,
                    "description": leaf.description,
                    "leaf_x": leaf.leaf_x,
                    "leaf_y": leaf.leaf_y,
                    "render_radius": leaf.render_radius,
                    "hit_radius": leaf.hit_radius,
                    "mastery_level": progress_by_leaf.get(leaf.id, 0),
                }
                for leaf in sorted(branch.leaves, key=lambda item: item.unlock_order)
            ]
            branches.append(
                BranchRead(
                    id=branch.id,
                    subject_key=branch.subject_key,
                    title=branch.title,
                    color_hex=branch.color_hex,
                    anchor_x=branch.anchor_x,
                    anchor_y=branch.anchor_y,
                    canopy_width=branch.canopy_width,
                    canopy_height=branch.canopy_height,
                    leaves=leaves,
                )
            )

        grades.append(
            GradeRead(
                id=grade.id,
                grade_code=grade.grade_code,
                title=grade.title,
                sort_order=grade.sort_order,
                branches=branches,
            )
        )

    return TreeSnapshotRead(profile_id=profile_id, grades=grades)


@router.get("/profiles/{profile_id}/lessons", response_model=LessonHistoryRead)
def read_profile_lessons(
    profile_id: int,
    limit: int = Query(default=12, ge=1, le=50),
    db: Session = Depends(get_db),
):
    profile = db.get(Profile, profile_id)
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")

    lesson_rows = (
        db.execute(
            select(Lesson)
            .join(Lesson.leaf)
            .join(Leaf.branch)
            .join(SubjectBranch.grade_level)
            .options(joinedload(Lesson.leaf).joinedload(Leaf.branch).joinedload(SubjectBranch.grade_level))
            .where(Lesson.profile_id == profile_id)
            .order_by(Lesson.created_at.desc(), Lesson.id.desc())
            .limit(limit)
        )
        .scalars()
        .unique()
        .all()
    )

    lessons = [build_lesson_history_item(lesson) for lesson in lesson_rows]
    return LessonHistoryRead(profile_id=profile_id, lessons=lessons)


@router.post("/lessons/{lesson_id}/complete", response_model=LessonCompletionResponse)
def complete_lesson(lesson_id: int, payload: LessonCompletionRequest, db: Session = Depends(get_db)):
    lesson = (
        db.execute(
            select(Lesson)
            .where(Lesson.id == lesson_id, Lesson.profile_id == payload.profile_id)
            .options(joinedload(Lesson.leaf).joinedload(Leaf.branch).joinedload(SubjectBranch.grade_level))
        )
        .scalars()
        .first()
    )
    if lesson is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lesson not found for this profile")

    quiz_result = score_completion_attempt(lesson, payload)

    completed_now, progress_row = apply_lesson_completion(
        lesson=lesson,
        correct_count=quiz_result.correct_count,
        question_count=quiz_result.question_count,
        should_complete=quiz_result.passed,
        db=db,
    )

    return LessonCompletionResponse(
        lesson=build_lesson_history_item(lesson),
        mastery_level=progress_row.mastery_level,
        lessons_completed=progress_row.lessons_completed,
        completed_now=completed_now,
        score=quiz_result.correct_count,
        total=quiz_result.question_count,
        passed=quiz_result.passed,
        passing_score=quiz_result.passing_score,
        feedback=quiz_result.feedback,
    )


@router.post("/generate-lesson/stream")
def generate_lesson_stream(payload: LessonStreamRequest, db: Session = Depends(get_db)):
    try:
        context = resolve_lesson_context(payload.profile_id, payload.leaf_id, db)
    except LessonEngineError as exc:
        detail = str(exc)
        status_code = status.HTTP_404_NOT_FOUND if "not found" in detail.lower() else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=status_code, detail=detail) from exc

    primary_model, _fallback_model = pick_lesson_models(context)

    def event_stream():
        selected_model = primary_model
        recovery_detail: str | None = None
        recovered = False

        yield sse_event(
            "start",
            {
                "profile_id": context.profile_id,
                "leaf_id": context.leaf_id,
                "title": context.leaf_title,
                "grade_title": context.grade_title,
                "subject_title": context.subject_title,
            },
        )

        try:
            package = build_validated_lesson_package(context)
            selected_model = "local-curriculum"
            lesson = build_generated_lesson_from_package(package)
            for chunk in lesson_stream_chunks(lesson.content):
                yield sse_event("token", {"text": chunk})
        except Exception as exc:  # noqa: BLE001
            recovered = True
            recovery_detail = str(exc)
            package = build_validated_lesson_package(context)
            selected_model = "local-curriculum"
            lesson = build_generated_lesson_from_package(package)

            yield sse_event(
                "replace",
                {
                    "title": lesson.title,
                    "content": lesson.content,
                    "vocabulary_words": lesson.vocabulary_words,
                    "lesson_package": package.model_dump(mode="json"),
                    "quiz": [question.model_dump(mode="json") for question in package.quiz],
                    "mastery_evidence": package.mastery_evidence.model_dump(mode="json"),
                    "curriculum_spec_id": package.curriculum_spec_id,
                    "generation_quality": package.generation_quality,
                    "message": "The live lesson stream stumbled, so a local fallback lesson was loaded.",
                },
            )

        try:
            with SessionLocal() as session:
                saved_lesson = save_generated_lesson(
                    profile_id=context.profile_id,
                    leaf_id=context.leaf_id,
                    lesson=lesson,
                    db=session,
                    raw_payload_json=json.dumps(
                        {
                            "model": selected_model,
                            "content": lesson.content,
                            "vocabulary_words": lesson.vocabulary_words,
                            "lesson_package": package.model_dump(mode="json"),
                            "quiz": [question.model_dump(mode="json") for question in package.quiz],
                            "mastery_evidence": package.mastery_evidence.model_dump(mode="json"),
                            "curriculum_spec_id": package.curriculum_spec_id,
                            "generation_quality": package.generation_quality,
                            "recovered": recovered,
                            "recovery_detail": recovery_detail,
                        },
                        ensure_ascii=False,
                    ),
                )
        except Exception as exc:  # noqa: BLE001
            yield sse_event(
                "error",
                {
                    "message": f"Lesson generated but could not be saved locally: {exc}",
                },
            )
            return

        yield sse_event(
            "complete",
            {
                "lesson": saved_lesson.model_dump(mode="json"),
                "recovered": recovered,
                "model": selected_model,
                "detail": recovery_detail,
            },
        )

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/branches/generate-leaves", response_model=LeafGenerationResponse, status_code=status.HTTP_201_CREATED)
def generate_branch_leaves(payload: LeafGenerationRequest, db: Session = Depends(get_db)):
    branch = resolve_branch(payload.grade, payload.subject, db)
    if branch is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Branch not found for the provided grade and subject")

    existing_leaf_titles = [leaf.title for leaf in sorted(branch.leaves, key=lambda item: item.unlock_order)]
    generation_context = LeafGenerationContext(
        grade=branch.grade_level.title,
        subject=branch.title,
        existing_subtopics=existing_leaf_titles,
        count=payload.count,
    )
    suggestions = generate_subtopics_direct(generation_context)

    next_unlock_order = max((leaf.unlock_order for leaf in branch.leaves), default=-1) + 1
    created_leaves: list[Leaf] = []

    existing_subtopic_keys = {leaf.subtopic_key for leaf in branch.leaves}

    for suggestion in suggestions:
        subtopic_key = slugify_token(suggestion.title)
        if not subtopic_key or subtopic_key in existing_subtopic_keys:
            continue

        leaf_x, leaf_y = compute_leaf_position(branch, next_unlock_order)
        leaf = Leaf(
            branch_id=branch.id,
            subtopic_key=subtopic_key,
            title=suggestion.title,
            description=suggestion.description,
            lesson_seed_prompt=f"Teach {suggestion.title} in {branch.title} for {branch.grade_level.title}.",
            leaf_x=leaf_x,
            leaf_y=leaf_y,
            render_radius=28.0,
            hit_radius=56.0,
            unlock_order=next_unlock_order,
        )
        db.add(leaf)
        created_leaves.append(leaf)
        existing_subtopic_keys.add(subtopic_key)
        next_unlock_order += 1

    db.commit()

    for leaf in created_leaves:
        db.refresh(leaf)

    return LeafGenerationResponse(
        grade=branch.grade_level.title,
        subject=branch.title,
        generated_count=len(created_leaves),
        leaves=[
            GeneratedLeafRead(
                id=leaf.id,
                title=leaf.title,
                subtopic_key=leaf.subtopic_key,
                description=leaf.description,
                leaf_x=leaf.leaf_x,
                leaf_y=leaf.leaf_y,
                render_radius=leaf.render_radius,
                hit_radius=leaf.hit_radius,
            )
            for leaf in created_leaves
        ],
    )


def save_generated_lesson(
    *,
    profile_id: int,
    leaf_id: int,
    lesson: GeneratedLesson,
    db: Session,
    raw_payload_json: str,
) -> LessonHistoryItemRead:
    leaf = (
        db.execute(
            select(Leaf)
            .where(Leaf.id == leaf_id)
            .options(joinedload(Leaf.branch).joinedload(SubjectBranch.grade_level))
        )
        .scalars()
        .first()
    )
    if leaf is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leaf not found for saving lesson")

    lesson_row = Lesson(
        profile_id=profile_id,
        leaf_id=leaf.id,
        lesson_title=lesson.title,
        body_text=lesson.content,
        vocabulary_words_json=json.dumps(lesson.vocabulary_words, ensure_ascii=False),
        raw_payload_json=raw_payload_json,
        is_completed=False,
    )
    db.add(lesson_row)
    db.commit()
    db.refresh(lesson_row)

    metadata = parse_lesson_metadata(lesson_row.raw_payload_json)
    return LessonHistoryItemRead(
        id=lesson_row.id,
        leaf_id=leaf.id,
        leaf_title=leaf.title,
        subject_title=leaf.branch.title,
        grade_title=leaf.branch.grade_level.title,
        title=lesson_row.lesson_title,
        content=lesson_row.body_text,
        vocabulary_words=json.loads(lesson_row.vocabulary_words_json),
        is_completed=lesson_row.is_completed,
        challenge_score=lesson_row.challenge_score,
        challenge_total=lesson_row.challenge_total,
        completed_at=lesson_row.completed_at,
        created_at=lesson_row.created_at,
        recovered=metadata["recovered"],
        recovery_detail=metadata["recovery_detail"],
        stream_model=metadata["stream_model"],
        lesson_package=metadata["lesson_package"],
        quiz=metadata["quiz"],
        mastery_evidence=metadata["mastery_evidence"],
        curriculum_spec_id=metadata["curriculum_spec_id"],
        generation_quality=metadata["generation_quality"],
    )


def apply_lesson_completion(
    *,
    lesson: Lesson,
    correct_count: int,
    question_count: int,
    should_complete: bool,
    db: Session,
) -> tuple[bool, ProfileLeafProgress]:
    progress_row = db.execute(
        select(ProfileLeafProgress).where(
            ProfileLeafProgress.profile_id == lesson.profile_id,
            ProfileLeafProgress.leaf_id == lesson.leaf_id,
        )
    ).scalar_one_or_none()

    if progress_row is None:
        progress_row = ProfileLeafProgress(
            profile_id=lesson.profile_id,
            leaf_id=lesson.leaf_id,
            lessons_completed=0,
            mastery_level=0,
        )
        db.add(progress_row)
        db.flush()

    completed_now = should_complete and not lesson.is_completed
    now = datetime.now(UTC).replace(tzinfo=None)

    if lesson.is_completed and lesson.challenge_score is not None and lesson.challenge_total is not None:
        lesson.challenge_score = max(lesson.challenge_score, correct_count)
        lesson.challenge_total = max(lesson.challenge_total, question_count)
    else:
        lesson.challenge_score = correct_count
        lesson.challenge_total = question_count

    if completed_now:
        lesson.is_completed = True
        lesson.completed_at = now
        progress_row.lessons_completed += 1
        progress_row.mastery_level = min(progress_row.lessons_completed, 5)
        progress_row.last_lesson_id = lesson.id
        progress_row.last_opened_at = now
        if progress_row.mastery_level >= 5:
            progress_row.completed_at = now

    db.commit()
    db.refresh(lesson)
    db.refresh(progress_row)
    return completed_now, progress_row


def build_lesson_history_item(lesson: Lesson) -> LessonHistoryItemRead:
    metadata = parse_lesson_metadata(lesson.raw_payload_json)
    return LessonHistoryItemRead(
        id=lesson.id,
        leaf_id=lesson.leaf_id,
        leaf_title=lesson.leaf.title,
        subject_title=lesson.leaf.branch.title,
        grade_title=lesson.leaf.branch.grade_level.title,
        title=lesson.lesson_title,
        content=lesson.body_text,
        vocabulary_words=json.loads(lesson.vocabulary_words_json),
        is_completed=lesson.is_completed,
        challenge_score=lesson.challenge_score,
        challenge_total=lesson.challenge_total,
        completed_at=lesson.completed_at,
        created_at=lesson.created_at,
        recovered=metadata["recovered"],
        recovery_detail=metadata["recovery_detail"],
        stream_model=metadata["stream_model"],
        lesson_package=metadata["lesson_package"],
        quiz=metadata["quiz"],
        mastery_evidence=metadata["mastery_evidence"],
        curriculum_spec_id=metadata["curriculum_spec_id"],
        generation_quality=metadata["generation_quality"],
    )


def score_completion_attempt(lesson: Lesson, payload: LessonCompletionRequest) -> QuizScoreResult:
    metadata = parse_lesson_metadata(lesson.raw_payload_json)
    package = metadata["lesson_package"]
    quiz = metadata["quiz"]

    if payload.answers is not None and package is not None and quiz is not None:
        return score_quiz_answers(quiz=quiz, submissions=payload.answers, tier=package.tier)

    if payload.correct_count is None or payload.question_count is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This lesson needs quiz answers for completion.")

    grade_sort_order = lesson.leaf.branch.grade_level.sort_order
    passing_score = passing_score_for_tier(tier_for_grade_sort_order(grade_sort_order), payload.question_count)
    feedback = [
        QuizFeedback(
            question_id="legacy-review",
            is_correct=payload.correct_count >= passing_score,
            correct_answer="Review the lesson and answer the practice questions.",
            explanation="Legacy review practice is scored in the browser because this saved lesson has no structured quiz package.",
            lesson_reference="Review Practice",
        )
    ]
    return QuizScoreResult(
        correct_count=payload.correct_count,
        question_count=payload.question_count,
        passed=payload.correct_count >= passing_score,
        passing_score=passing_score,
        feedback=feedback,
    )


def parse_lesson_metadata(raw_payload_json: str) -> dict[str, object]:
    try:
        payload = json.loads(raw_payload_json)
    except json.JSONDecodeError:
        payload = {}

    lesson_package = parse_optional_model(payload.get("lesson_package"), LessonPackage)
    quiz_payload = payload.get("quiz")
    quiz = None
    if isinstance(quiz_payload, list):
        try:
            quiz = [QuizQuestion.model_validate(question) for question in quiz_payload]
        except ValueError:
            quiz = None

    mastery_evidence = parse_optional_model(payload.get("mastery_evidence"), MasteryEvidence)

    return {
        "recovered": bool(payload.get("recovered", False)),
        "recovery_detail": payload.get("recovery_detail") if isinstance(payload.get("recovery_detail"), str) else None,
        "stream_model": payload.get("model") if isinstance(payload.get("model"), str) else None,
        "lesson_package": lesson_package,
        "quiz": quiz,
        "mastery_evidence": mastery_evidence,
        "curriculum_spec_id": payload.get("curriculum_spec_id") if isinstance(payload.get("curriculum_spec_id"), str) else None,
        "generation_quality": payload.get("generation_quality") if isinstance(payload.get("generation_quality"), str) else None,
    }


def parse_optional_model(value: object, model_type):
    if not isinstance(value, dict):
        return None
    try:
        return model_type.model_validate(value)
    except ValueError:
        return None


def lesson_stream_chunks(content: str):
    blocks = [block.strip() for block in re.split(r"(\n\n+)", content) if block.strip()]
    for block in blocks:
        yield f"{block}\n\n"


def sse_event(event: str, data: dict[str, Any]) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}"


def resolve_branch(grade: str, subject: str, db: Session) -> SubjectBranch | None:
    grade_key = normalize_lookup_token(grade)
    subject_key = normalize_lookup_token(subject)

    branches = (
        db.execute(
            select(SubjectBranch)
            .join(SubjectBranch.grade_level)
            .options(joinedload(SubjectBranch.grade_level), selectinload(SubjectBranch.leaves))
        )
        .scalars()
        .unique()
        .all()
    )

    for branch in branches:
        grade_matches = {
            normalize_lookup_token(branch.grade_level.grade_code),
            normalize_lookup_token(branch.grade_level.title),
        }
        subject_matches = {
            normalize_lookup_token(branch.subject_key),
            normalize_lookup_token(branch.title),
        }

        if grade_key in grade_matches and subject_key in subject_matches:
            return branch

    return None


def normalize_lookup_token(value: str) -> str:
    cleaned = re.sub(r"[^a-z0-9]+", "-", value.strip().lower())
    return cleaned.strip("-")
