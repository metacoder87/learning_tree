from __future__ import annotations

from math import ceil
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


GradeComplexityTier = Literal["early", "elementary", "middle", "high"]
GenerationQuality = Literal["ai_validated", "local_validated", "local_fallback", "legacy_review"]
LessonSectionKind = Literal[
    "objective",
    "hook",
    "direct-teaching",
    "worked-example",
    "guided-practice",
    "common-mistake",
    "independent-check",
    "recap",
]
QuizQuestionType = Literal["multiple-choice", "fill-blank", "sequence", "classify", "short-response"]
QuizAnswerValue = str | list[str] | dict[str, str]


REQUIRED_SECTION_SEQUENCE: tuple[LessonSectionKind, ...] = (
    "objective",
    "hook",
    "direct-teaching",
    "worked-example",
    "guided-practice",
    "common-mistake",
    "independent-check",
    "recap",
)

MIN_QUIZ_QUESTIONS_BY_TIER: dict[GradeComplexityTier, int] = {
    "early": 3,
    "elementary": 4,
    "middle": 5,
    "high": 5,
}

GENERIC_FILLER_PHRASES = {
    "this topic is important",
    "in this lesson we will learn about",
    "there are many things to know",
    "learning is fun",
    "many people use this",
}


class VocabularyTerm(BaseModel):
    model_config = ConfigDict(extra="forbid")

    term: str = Field(min_length=1, max_length=80)
    definition: str = Field(min_length=8, max_length=260)

    @field_validator("term", "definition")
    @classmethod
    def clean_text(cls, value: str) -> str:
        return " ".join(value.strip().split())


class LessonSection(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: LessonSectionKind
    title: str = Field(min_length=1, max_length=120)
    body: str = Field(min_length=20)

    @field_validator("title", "body")
    @classmethod
    def clean_text(cls, value: str) -> str:
        return " ".join(value.strip().split())


class WorkedExample(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1, max_length=80)
    title: str = Field(min_length=1, max_length=120)
    prompt: str = Field(min_length=10, max_length=400)
    steps: list[str] = Field(min_length=2, max_length=6)
    answer: str = Field(min_length=1, max_length=260)
    lesson_reference: str = Field(min_length=1, max_length=120)

    @field_validator("id", "title", "prompt", "answer", "lesson_reference")
    @classmethod
    def clean_text(cls, value: str) -> str:
        return " ".join(value.strip().split())

    @field_validator("steps")
    @classmethod
    def clean_steps(cls, value: list[str]) -> list[str]:
        return [" ".join(step.strip().split()) for step in value if step.strip()]


class PracticePrompt(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1, max_length=80)
    prompt: str = Field(min_length=10, max_length=420)
    expected_response_hint: str = Field(min_length=8, max_length=260)
    lesson_reference: str = Field(min_length=1, max_length=120)

    @field_validator("id", "prompt", "expected_response_hint", "lesson_reference")
    @classmethod
    def clean_text(cls, value: str) -> str:
        return " ".join(value.strip().split())


class QuizChoice(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1, max_length=80)
    label: str = Field(min_length=1, max_length=180)
    is_correct: bool = False

    @field_validator("id", "label")
    @classmethod
    def clean_text(cls, value: str) -> str:
        return " ".join(value.strip().split())


class QuizQuestion(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1, max_length=80)
    type: QuizQuestionType
    prompt: str = Field(min_length=10, max_length=700)
    choices: list[QuizChoice] = Field(default_factory=list)
    categories: list[str] = Field(default_factory=list)
    answer_key: QuizAnswerValue | None = None
    explanation: str = Field(min_length=12, max_length=700)
    lesson_reference: str = Field(min_length=1, max_length=140)

    @field_validator("id", "prompt", "explanation", "lesson_reference")
    @classmethod
    def clean_text(cls, value: str) -> str:
        return " ".join(value.strip().split())

    @field_validator("categories")
    @classmethod
    def clean_categories(cls, value: list[str]) -> list[str]:
        cleaned: list[str] = []
        seen: set[str] = set()
        for category in value:
            normalized = " ".join(category.strip().split())
            token = normalize_answer(normalized)
            if normalized and token not in seen:
                cleaned.append(normalized)
                seen.add(token)
        return cleaned

    @model_validator(mode="after")
    def validate_question(self) -> "QuizQuestion":
        labels = [choice.label for choice in self.choices]
        normalized_labels = [normalize_answer(label) for label in labels]
        if len(normalized_labels) != len(set(normalized_labels)):
            raise ValueError("Quiz choices must not contain duplicate labels.")

        if self.type == "multiple-choice":
            correct_choices = [choice for choice in self.choices if choice.is_correct]
            if len(self.choices) < 2:
                raise ValueError("Multiple-choice questions need at least two choices.")
            if len(correct_choices) != 1:
                raise ValueError("Multiple-choice questions need exactly one correct choice.")
            if self.answer_key is None:
                self.answer_key = correct_choices[0].label

        if self.type in {"fill-blank", "short-response"}:
            if not self.answer_key:
                raise ValueError(f"{self.type} questions need an answer key.")

        if self.type == "sequence":
            if len(self.choices) < 2:
                raise ValueError("Sequence questions need at least two items.")
            if not isinstance(self.answer_key, list) or len(self.answer_key) != len(self.choices):
                raise ValueError("Sequence questions need an ordered answer list matching the item count.")

        if self.type == "classify":
            if len(self.choices) < 2 or len(self.categories) < 2:
                raise ValueError("Classify questions need choices and at least two categories.")
            if not isinstance(self.answer_key, dict):
                raise ValueError("Classify questions need an answer-key mapping.")

            valid_items = {normalize_answer(choice.label) for choice in self.choices} | {
                normalize_answer(choice.id) for choice in self.choices
            }
            valid_categories = {normalize_answer(category) for category in self.categories}
            for item, category in self.answer_key.items():
                if normalize_answer(item) not in valid_items:
                    raise ValueError("Classify answer key references an unknown item.")
                if normalize_answer(category) not in valid_categories:
                    raise ValueError("Classify answer key references an unknown category.")

        return self


class MasteryEvidence(BaseModel):
    model_config = ConfigDict(extra="forbid")

    can_do_statement: str = Field(min_length=12, max_length=260)
    evidence_prompt: str = Field(min_length=12, max_length=420)
    mastery_threshold: int = Field(ge=1)

    @field_validator("can_do_statement", "evidence_prompt")
    @classmethod
    def clean_text(cls, value: str) -> str:
        return " ".join(value.strip().split())


class LessonPackage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    package_id: str = Field(min_length=1, max_length=120)
    curriculum_spec_id: str = Field(min_length=1, max_length=120)
    title: str = Field(min_length=1, max_length=200)
    grade_title: str = Field(min_length=1, max_length=80)
    subject_title: str = Field(min_length=1, max_length=80)
    tier: GradeComplexityTier
    objective: str = Field(min_length=20, max_length=360)
    sections: list[LessonSection] = Field(min_length=len(REQUIRED_SECTION_SEQUENCE))
    worked_examples: list[WorkedExample] = Field(min_length=1, max_length=3)
    guided_practice: list[PracticePrompt] = Field(min_length=1, max_length=4)
    vocabulary: list[VocabularyTerm] = Field(min_length=5, max_length=5)
    quiz: list[QuizQuestion]
    mastery_evidence: MasteryEvidence
    generation_quality: GenerationQuality

    @field_validator("package_id", "curriculum_spec_id", "title", "grade_title", "subject_title", "objective")
    @classmethod
    def clean_text(cls, value: str) -> str:
        return " ".join(value.strip().split())

    @model_validator(mode="after")
    def validate_package(self) -> "LessonPackage":
        section_sequence = [section.kind for section in self.sections[: len(REQUIRED_SECTION_SEQUENCE)]]
        if tuple(section_sequence) != REQUIRED_SECTION_SEQUENCE:
            raise ValueError("LessonPackage sections must follow the required teaching sequence.")

        required_question_count = MIN_QUIZ_QUESTIONS_BY_TIER[self.tier]
        if len(self.quiz) != required_question_count:
            raise ValueError(f"{self.tier} lessons require exactly {required_question_count} quiz questions.")

        combined_text = " ".join(
            [
                self.objective,
                *[section.body for section in self.sections],
                *[question.prompt for question in self.quiz],
            ]
        ).lower()
        for phrase in GENERIC_FILLER_PHRASES:
            if phrase in combined_text:
                raise ValueError("LessonPackage contains generic filler language.")

        objective_terms = {
            token
            for token in normalize_answer(self.objective).split()
            if len(token) >= 5 and token not in {"student", "students", "learner", "learners", "explain"}
        }
        if objective_terms and not any(term in combined_text for term in list(objective_terms)[:4]):
            raise ValueError("LessonPackage does not appear to reference the curriculum objective.")

        return self


class QuizAnswerSubmission(BaseModel):
    model_config = ConfigDict(extra="forbid")

    question_id: str = Field(min_length=1, max_length=80)
    value: QuizAnswerValue

    @field_validator("question_id")
    @classmethod
    def clean_question_id(cls, value: str) -> str:
        return " ".join(value.strip().split())


class QuizFeedback(BaseModel):
    model_config = ConfigDict(extra="forbid")

    question_id: str
    is_correct: bool
    correct_answer: str
    explanation: str
    lesson_reference: str


class QuizScoreResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    correct_count: int
    question_count: int
    passed: bool
    passing_score: int
    feedback: list[QuizFeedback]


def passing_score_for_tier(tier: GradeComplexityTier, question_count: int) -> int:
    if tier == "early":
        return max(2, question_count - 1)
    if tier == "elementary":
        return max(3, question_count - 1)
    return max(4, ceil(question_count * 0.8))


def normalize_answer(value: str) -> str:
    return " ".join(value.strip().lower().split())


def normalize_answer_value(value: QuizAnswerValue) -> QuizAnswerValue:
    if isinstance(value, str):
        return normalize_answer(value)
    if isinstance(value, list):
        return [normalize_answer(item) for item in value]
    return {normalize_answer(key): normalize_answer(answer) for key, answer in value.items()}


def score_quiz_answers(
    *,
    quiz: list[QuizQuestion],
    submissions: list[QuizAnswerSubmission],
    tier: GradeComplexityTier,
) -> QuizScoreResult:
    submission_by_id = {submission.question_id: submission.value for submission in submissions}
    correct_count = 0
    feedback: list[QuizFeedback] = []

    for question in quiz:
        given = submission_by_id.get(question.id, "")
        is_correct = answer_matches_question(question, given)
        if is_correct:
            correct_count += 1

        feedback.append(
            QuizFeedback(
                question_id=question.id,
                is_correct=is_correct,
                correct_answer=human_correct_answer(question),
                explanation=question.explanation,
                lesson_reference=question.lesson_reference,
            )
        )

    passing_score = passing_score_for_tier(tier, len(quiz))
    return QuizScoreResult(
        correct_count=correct_count,
        question_count=len(quiz),
        passed=correct_count >= passing_score,
        passing_score=passing_score,
        feedback=feedback,
    )


def answer_matches_question(question: QuizQuestion, given: Any) -> bool:
    if question.type == "multiple-choice":
        correct_choice = next((choice for choice in question.choices if choice.is_correct), None)
        if correct_choice is None:
            return False
        normalized_given = normalize_answer(str(given))
        return normalized_given in {
            normalize_answer(correct_choice.id),
            normalize_answer(correct_choice.label),
            normalize_answer(str(question.answer_key or "")),
        }

    if question.type in {"fill-blank", "short-response"}:
        accepted_answers = question.answer_key if isinstance(question.answer_key, list) else [str(question.answer_key or "")]
        normalized_given = normalize_answer(str(given))
        return any(normalized_given == normalize_answer(answer) for answer in accepted_answers)

    if question.type == "sequence":
        if not isinstance(given, list) or not isinstance(question.answer_key, list):
            return False
        return normalize_answer_value(given) == normalize_answer_value(question.answer_key)

    if question.type == "classify":
        if not isinstance(given, dict) or not isinstance(question.answer_key, dict):
            return False
        normalized_given = normalize_answer_value(given)
        normalized_key = normalize_answer_value(question.answer_key)
        return normalized_given == normalized_key

    return False


def human_correct_answer(question: QuizQuestion) -> str:
    if question.type == "multiple-choice":
        correct_choice = next((choice for choice in question.choices if choice.is_correct), None)
        return correct_choice.label if correct_choice else ""

    if isinstance(question.answer_key, list):
        return " -> ".join(question.answer_key)

    if isinstance(question.answer_key, dict):
        return "; ".join(f"{item}: {category}" for item, category in question.answer_key.items())

    return str(question.answer_key or "")
