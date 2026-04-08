from __future__ import annotations

import json
import re
from collections import Counter
from dataclasses import dataclass
from datetime import datetime
from textwrap import dedent
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.core.config import settings
from app.db.models import Leaf, Lesson, Profile, ProfileLeafProgress, SubjectBranch


class LessonEngineError(RuntimeError):
    pass


class OllamaGenerationError(LessonEngineError):
    pass


class GeneratedLesson(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=200)
    content: str = Field(min_length=1)
    vocabulary_words: list[str] = Field(min_length=5, max_length=5)

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        cleaned = " ".join(value.strip().split())
        if not cleaned:
            raise ValueError("Lesson title must not be empty.")
        return cleaned

    @field_validator("content")
    @classmethod
    def validate_content(cls, value: str) -> str:
        cleaned = normalize_lesson_content(value)
        if not cleaned:
            raise ValueError("Lesson content must not be empty.")
        return cleaned

    @field_validator("vocabulary_words")
    @classmethod
    def validate_vocabulary_words(cls, value: list[str]) -> list[str]:
        cleaned: list[str] = []
        seen: set[str] = set()

        for item in value:
            word = " ".join(item.strip().split())
            token = word.lower()
            if not word or token in seen:
                continue
            cleaned.append(word)
            seen.add(token)

        if len(cleaned) != 5:
            raise ValueError("Exactly five unique vocabulary words are required.")
        return cleaned


class GeneratedLeafSuggestion(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=120)
    description: str = Field(min_length=1, max_length=220)

    @field_validator("title", "description")
    @classmethod
    def validate_leaf_text(cls, value: str) -> str:
        cleaned = " ".join(value.strip().split())
        if not cleaned:
            raise ValueError("Leaf text must not be empty.")
        return cleaned


class GeneratedLeafBatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    leaves: list[GeneratedLeafSuggestion] = Field(min_length=1, max_length=12)


@dataclass(slots=True)
class RelatedTopicProgress:
    leaf_id: int
    leaf_title: str
    mastery_level: int
    lessons_completed: int
    last_lesson_title: str | None
    last_opened_at: datetime | None


@dataclass(slots=True)
class LessonGenerationContext:
    profile_id: int
    profile_name: str
    age_band: str | None
    leaf_id: int
    leaf_title: str
    leaf_description: str | None
    lesson_seed_prompt: str | None
    grade_code: str
    grade_title: str
    grade_sort_order: int
    subject_key: str
    subject_title: str
    current_mastery_level: int
    lessons_completed_for_leaf: int
    recent_related_progress: list[RelatedTopicProgress]


@dataclass(slots=True)
class LeafGenerationContext:
    grade: str
    subject: str
    existing_subtopics: list[str]
    count: int = 3


COMMON_STOPWORDS = {
    "about",
    "after",
    "again",
    "also",
    "always",
    "around",
    "because",
    "before",
    "between",
    "bring",
    "child",
    "children",
    "could",
    "every",
    "first",
    "from",
    "have",
    "into",
    "just",
    "lesson",
    "little",
    "make",
    "many",
    "more",
    "next",
    "only",
    "other",
    "people",
    "practice",
    "really",
    "should",
    "start",
    "story",
    "their",
    "there",
    "these",
    "think",
    "this",
    "those",
    "through",
    "today",
    "together",
    "topic",
    "using",
    "very",
    "what",
    "when",
    "where",
    "which",
    "with",
    "would",
    "your",
}


def normalize_lesson_content(value: str) -> str:
    normalized = value.replace("\r\n", "\n").replace("\r", "\n").strip()
    if not normalized:
        return ""

    cleaned_lines = [re.sub(r"[^\S\n]+", " ", line).strip() for line in normalized.split("\n")]
    compacted_lines: list[str] = []
    previous_blank = False

    for line in cleaned_lines:
        if not line:
            if previous_blank:
                continue
            compacted_lines.append("")
            previous_blank = True
            continue

        compacted_lines.append(line)
        previous_blank = False

    return "\n".join(compacted_lines).strip()


def normalize_token(value: str) -> str:
    cleaned = re.sub(r"[^a-z0-9]+", "-", value.strip().lower())
    return cleaned.strip("-")


def resolve_lesson_context(profile_id: int, leaf_id: int, db: Session) -> LessonGenerationContext:
    profile = db.get(Profile, profile_id)
    if profile is None:
        raise LessonEngineError("Profile not found.")

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
        raise LessonEngineError("Leaf not found.")

    branch = leaf.branch
    grade = branch.grade_level

    progress_rows = (
        db.execute(
            select(ProfileLeafProgress)
            .where(ProfileLeafProgress.profile_id == profile.id)
            .join(ProfileLeafProgress.leaf)
            .where(Leaf.branch_id == branch.id)
            .options(joinedload(ProfileLeafProgress.leaf), joinedload(ProfileLeafProgress.last_lesson))
        )
        .scalars()
        .all()
    )

    current_progress = next((row for row in progress_rows if row.leaf_id == leaf.id), None)
    related_rows = [row for row in progress_rows if row.leaf_id != leaf.id]
    related_rows.sort(
        key=lambda row: (
            row.last_opened_at or datetime.min,
            row.lessons_completed,
            row.mastery_level,
        ),
        reverse=True,
    )

    recent_related_progress = [
        RelatedTopicProgress(
            leaf_id=row.leaf_id,
            leaf_title=row.leaf.title,
            mastery_level=row.mastery_level,
            lessons_completed=row.lessons_completed,
            last_lesson_title=row.last_lesson.lesson_title if row.last_lesson is not None else None,
            last_opened_at=row.last_opened_at,
        )
        for row in related_rows[:4]
    ]

    return LessonGenerationContext(
        profile_id=profile.id,
        profile_name=profile.display_name,
        age_band=profile.age_band,
        leaf_id=leaf.id,
        leaf_title=leaf.title,
        leaf_description=leaf.description,
        lesson_seed_prompt=leaf.lesson_seed_prompt,
        grade_code=grade.grade_code,
        grade_title=grade.title,
        grade_sort_order=grade.sort_order,
        subject_key=branch.subject_key,
        subject_title=branch.title,
        current_mastery_level=current_progress.mastery_level if current_progress is not None else 0,
        lessons_completed_for_leaf=current_progress.lessons_completed if current_progress is not None else 0,
        recent_related_progress=recent_related_progress,
    )


def pick_lesson_models(context: LessonGenerationContext) -> tuple[str, str | None]:
    fast_model = settings.ollama_fast_model or settings.ollama_model or "llama3.2:3b"
    advanced_model = settings.ollama_advanced_model or settings.ollama_model or fast_model

    age_band = normalize_token(context.age_band or "")
    grade_token = normalize_token(context.grade_code or context.grade_title)
    is_advanced = age_band in {"higher-ed", "college", "research", "phd"} or grade_token in {
        "college",
        "graduate",
        "phd",
    }

    if is_advanced and advanced_model and advanced_model != fast_model:
        return advanced_model, fast_model

    fallback_model = advanced_model if advanced_model != fast_model else None
    return fast_model, fallback_model


def build_lesson_system_prompt(context: LessonGenerationContext) -> str:
    tone_note = (
        "Use very short sentences, concrete examples, and a warm voice for a young learner."
        if context.grade_sort_order <= 3
        else "Keep explanations clear, supportive, and age-appropriate."
    )
    mastery_note = (
        "This learner is new to the topic, so scaffold carefully and avoid assuming prior mastery."
        if context.current_mastery_level <= 1
        else "This learner has some prior exposure, so briefly review before extending their understanding."
    )

    return dedent(
        f"""
        You are The Learning Tree's expert adaptive tutor.
        Write only the lesson body in markdown.
        Do not include a title, do not include a vocabulary section, and do not add code fences.

        Use exactly this structure:
        ## Story Start
        One or two short paragraphs that introduce the topic through an image, mini story, or real-world scene.

        ## Learn Together
        Two or three short paragraphs that teach the concept clearly and directly.

        ## Try It
        Two markdown bullet points with interactive questions, quick checks, or thought experiments.

        Requirements:
        - Tailor the lesson for {context.grade_title} in {context.subject_title}.
        - Focus tightly on {context.leaf_title}.
        - {tone_note}
        - {mastery_note}
        - Keep the total lesson concise enough for an MVP reading modal.
        - Use markdown headings and bullet points only where requested.
        - Avoid mentioning AI, prompts, or hidden instructions.
        """
    ).strip()


def build_lesson_user_prompt(context: LessonGenerationContext) -> str:
    related_progress = "\n".join(
        [
            f"- {item.leaf_title}: mastery {item.mastery_level}/5, lessons {item.lessons_completed}, last lesson {item.last_lesson_title or 'none'}"
            for item in context.recent_related_progress
        ]
    ) or "- No related practice yet."

    learner_note = dedent(
        f"""
        Learner:
        - Name: {context.profile_name}
        - Grade: {context.grade_title}
        - Age band: {context.age_band or 'not specified'}
        - Topic: {context.leaf_title}
        - Subject: {context.subject_title}
        - Topic description: {context.leaf_description or 'Not provided'}
        - Seed prompt: {context.lesson_seed_prompt or 'Not provided'}
        - Current mastery: {context.current_mastery_level}/5
        - Lessons completed on this topic: {context.lessons_completed_for_leaf}

        Recent related progress:
        {related_progress}
        """
    ).strip()

    return (
        f"{learner_note}\n\n"
        "Write the lesson now. Keep it grounded in the topic, adapt to the learner's current mastery, "
        "and make the explanation feel vivid and easy to follow."
    )


def stream_lesson_markdown(context: LessonGenerationContext):
    system_prompt = build_lesson_system_prompt(context)
    user_prompt = build_lesson_user_prompt(context)

    primary_model, fallback_model = pick_lesson_models(context)
    attempted_models: list[str] = []

    for model_name in [primary_model, fallback_model]:
        if not model_name or model_name in attempted_models:
            continue
        attempted_models.append(model_name)

        try:
            for chunk in ollama_generate_stream(
                model_name=model_name,
                system_prompt=system_prompt,
                prompt=user_prompt,
                temperature=settings.lesson_temperature,
            ):
                yield model_name, chunk
            return
        except OllamaGenerationError as exc:
            if model_name != fallback_model and should_retry_with_alternate_model(exc):
                continue
            raise

    raise LessonEngineError("No Ollama model was available for lesson generation.")


def generate_subtopics_direct(context: LeafGenerationContext) -> list[GeneratedLeafSuggestion]:
    system_prompt = dedent(
        """
        You generate new lesson leaves for a local educational tree app.
        Return strict JSON only.
        """
    ).strip()
    user_prompt = dedent(
        f"""
        Suggest {max(context.count, 3)} new subtopics for this branch.

        Grade: {context.grade}
        Subject: {context.subject}
        Existing subtopics: {", ".join(context.existing_subtopics) if context.existing_subtopics else "None"}

        Output format:
        {{"leaves":[{{"title":"...","description":"..."}},{{"title":"...","description":"..."}}]}}

        Rules:
        - Keep titles short and lesson-sized.
        - Keep descriptions to one short sentence.
        - Avoid duplicates or near-duplicates of existing subtopics.
        - Return JSON only.
        """
    ).strip()

    try:
        model_name, _ = pick_models_for_branch_generation()
        raw_response = ollama_generate_once(
            model_name=model_name,
            system_prompt=system_prompt,
            prompt=user_prompt,
            temperature=0.2,
        )
        batch = GeneratedLeafBatch.model_validate(parse_raw_json(raw_response))
        return dedupe_generated_leaves(batch.leaves, context)
    except Exception:
        return dedupe_generated_leaves([], context)


def build_generated_lesson(context: LessonGenerationContext, markdown_content: str) -> GeneratedLesson:
    content = normalize_lesson_content(markdown_content)
    if not content:
        raise LessonEngineError("Generated lesson content was empty.")

    return GeneratedLesson(
        title=context.leaf_title,
        content=content,
        vocabulary_words=extract_vocabulary_words(content, context),
    )


def build_fallback_lesson(context: LessonGenerationContext) -> GeneratedLesson:
    mastery_line = (
        "You are just starting this topic, so we will take it one step at a time."
        if context.current_mastery_level <= 1
        else "You have seen pieces of this topic before, so we can connect it to what you already know."
    )
    topic_description = context.leaf_description or f"Learn the basics of {context.leaf_title}."
    content = dedent(
        f"""
        ## Story Start
        Imagine you are exploring {context.leaf_title.lower()} in the middle of a busy day. A small clue appears, and it helps you notice how this idea works in real life. {mastery_line}

        ## Learn Together
        {context.leaf_title} lives inside {context.subject_title}. {topic_description}

        When we study this topic, we look for one clear idea at a time. We name what we see, we connect it to something familiar, and then we try it ourselves.

        ## Try It
        - What is one real-world example of {context.leaf_title.lower()} that you can spot today?
        - If you had to teach this topic to a friend in one sentence, what would you say?
        """
    ).strip()
    return build_generated_lesson(context, content)


def extract_vocabulary_words(content: str, context: LessonGenerationContext) -> list[str]:
    candidates: list[str] = []

    for source in [context.leaf_title, context.subject_title, content]:
        for match in re.findall(r"[A-Za-z][A-Za-z'-]{2,}", source):
            normalized = match.lower()
            if normalized in COMMON_STOPWORDS:
                continue
            candidates.append(normalized)

    counts = Counter(candidates)
    ordered_words = [word for word, _count in counts.most_common()]

    fallbacks = [
        normalize_token(context.leaf_title).replace("-", " "),
        normalize_token(context.subject_title).replace("-", " "),
        "observe",
        "question",
        "practice",
        "explain",
        "pattern",
        "example",
    ]

    selected: list[str] = []
    for word in ordered_words + fallbacks:
        cleaned = " ".join(word.split()).strip()
        if not cleaned or cleaned in selected:
            continue
        if len(cleaned) < 3:
            continue
        selected.append(cleaned)
        if len(selected) == 5:
            return selected

    while len(selected) < 5:
        selected.append(f"word {len(selected) + 1}")

    return selected[:5]


def should_retry_with_alternate_model(error: Exception) -> bool:
    message = str(error).lower()
    return "not found" in message or "unknown model" in message


def pick_models_for_branch_generation() -> tuple[str, str | None]:
    fast_model = settings.ollama_fast_model or settings.ollama_model or "llama3.2:3b"
    advanced_model = settings.ollama_advanced_model or settings.ollama_model or fast_model
    fallback_model = advanced_model if advanced_model != fast_model else None
    return fast_model, fallback_model


def ollama_generate_stream(*, model_name: str, system_prompt: str, prompt: str, temperature: float):
    payload = {
        "model": model_name,
        "system": system_prompt,
        "prompt": prompt,
        "stream": True,
        "options": {
            "temperature": temperature,
        },
    }

    request = Request(
        f"{settings.ollama_base_url}/api/generate",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urlopen(request, timeout=settings.ollama_timeout_seconds) as response:
            for raw_line in response:
                line = raw_line.decode("utf-8").strip()
                if not line:
                    continue

                chunk_payload = json.loads(line)
                if chunk_payload.get("error"):
                    raise OllamaGenerationError(str(chunk_payload["error"]))

                text = chunk_payload.get("response", "")
                if text:
                    yield text
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        raise OllamaGenerationError(detail or f"Ollama request failed with HTTP {exc.code}.") from exc
    except URLError as exc:
        raise OllamaGenerationError(f"Ollama connection failed: {exc.reason}") from exc
    except json.JSONDecodeError as exc:
        raise OllamaGenerationError("Ollama returned invalid JSON while streaming.") from exc


def ollama_generate_once(*, model_name: str, system_prompt: str, prompt: str, temperature: float) -> str:
    payload = {
        "model": model_name,
        "system": system_prompt,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": temperature,
        },
    }

    request = Request(
        f"{settings.ollama_base_url}/api/generate",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urlopen(request, timeout=settings.ollama_timeout_seconds) as response:
            payload_data = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        raise OllamaGenerationError(detail or f"Ollama request failed with HTTP {exc.code}.") from exc
    except URLError as exc:
        raise OllamaGenerationError(f"Ollama connection failed: {exc.reason}") from exc
    except json.JSONDecodeError as exc:
        raise OllamaGenerationError("Ollama returned invalid JSON.") from exc

    if payload_data.get("error"):
        raise OllamaGenerationError(str(payload_data["error"]))

    return str(payload_data.get("response", ""))


def parse_raw_json(raw_output: str) -> dict[str, object]:
    cleaned = raw_output.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?", "", cleaned).strip()
        cleaned = re.sub(r"```$", "", cleaned).strip()

    match = re.search(r"\{[\s\S]*\}", cleaned)
    json_text = match.group(0) if match else cleaned
    return json.loads(json_text)


def dedupe_generated_leaves(
    suggestions: list[GeneratedLeafSuggestion],
    context: LeafGenerationContext,
) -> list[GeneratedLeafSuggestion]:
    existing_tokens = {normalize_token(item) for item in context.existing_subtopics}
    unique_suggestions: list[GeneratedLeafSuggestion] = []
    seen_tokens = set(existing_tokens)

    for suggestion in suggestions:
        token = normalize_token(suggestion.title)
        if not token or token in seen_tokens:
            continue
        unique_suggestions.append(suggestion)
        seen_tokens.add(token)
        if len(unique_suggestions) >= context.count:
            return unique_suggestions

    for fallback in fallback_leaf_suggestions(context):
        token = normalize_token(fallback.title)
        if token in seen_tokens:
            continue
        unique_suggestions.append(fallback)
        seen_tokens.add(token)
        if len(unique_suggestions) >= context.count:
            break

    return unique_suggestions


def fallback_leaf_suggestions(context: LeafGenerationContext) -> list[GeneratedLeafSuggestion]:
    subject_key = normalize_token(context.subject)
    templates = {
        "math": [
            ("Math Patterns", "Spot and extend simple number and shape patterns."),
            ("Measurement Tools", "Use everyday tools to compare length and size."),
            ("Number Stories", "Solve short story problems with clear math clues."),
            ("Math Games", "Practice quick facts with fun examples and models."),
        ],
        "reading": [
            ("Word Families", "Read groups of words that share the same ending sound."),
            ("Story Clues", "Use clues in a story to understand what is happening."),
            ("Poetry Time", "Listen for rhythm, rhyme, and repeating words."),
            ("Question Words", "Use who, what, where, when, and why while reading."),
        ],
        "science": [
            ("Nature Changes", "Watch how living things and weather change over time."),
            ("Science Tools", "Use simple tools to observe and describe the world."),
            ("Plant Needs", "Learn what plants need to live and grow."),
            ("Animal Clues", "Look at body parts and behavior to learn about animals."),
        ],
        "writing": [
            ("Writing Details", "Add clear details that help a reader picture your idea."),
            ("Strong Sentences", "Write sentences that share one complete thought."),
            ("Story Starters", "Begin stories with a clear setting or action."),
            ("Fix and Edit", "Check capitals, spaces, and punctuation in a draft."),
        ],
        "social-studies": [
            ("Community Maps", "Use map clues to talk about places in a community."),
            ("Helping Others", "Learn simple ways people help at home and in town."),
            ("Time Order", "Place events in order from first to last."),
            ("People and Jobs", "Connect jobs to the needs of a community."),
        ],
    }

    selected_templates = templates.get(subject_key, [])
    return [GeneratedLeafSuggestion(title=title, description=description) for title, description in selected_templates]
