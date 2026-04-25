import type { LessonHistoryItem, LessonTier, QuizAnswerValue, QuizQuestion } from "../types/lesson";


export type LessonGameTargetSource = "quiz" | "vocabulary" | "worked-example" | "lesson-title" | "fallback";

export interface LessonGameTarget {
  id: string;
  label: string;
  source: LessonGameTargetSource;
  subject: string;
  tier?: LessonTier;
}

const MAX_TARGETS = 12;
const MAX_LABEL_LENGTH = 28;


function normalizeTarget(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}


function compactLabel(value: string) {
  const cleaned = value.trim().replace(/\s+/g, " ");
  if (cleaned.length <= MAX_LABEL_LENGTH) {
    return cleaned;
  }

  const tokens = cleaned.match(/[A-Za-z0-9:+'-]+/g) ?? [];
  return tokens.slice(0, 4).join(" ").slice(0, MAX_LABEL_LENGTH).trim();
}


function addTarget(
  targets: LessonGameTarget[],
  seen: Set<string>,
  value: string | null | undefined,
  source: LessonGameTargetSource,
  subject: string,
  tier?: LessonTier,
) {
  const label = compactLabel(value ?? "");
  const normalized = normalizeTarget(label);
  if (!normalized || normalized.length < 1 || seen.has(normalized)) {
    return;
  }

  seen.add(normalized);
  targets.push({
    id: `${source}-${normalized.replace(/[^a-z0-9]+/g, "-")}`,
    label,
    source,
    subject,
    tier,
  });
}


function answerValues(answerKey: QuizAnswerValue | null | undefined) {
  if (!answerKey) {
    return [];
  }

  if (typeof answerKey === "string") {
    return [answerKey];
  }

  if (Array.isArray(answerKey)) {
    return answerKey;
  }

  return Object.keys(answerKey);
}


function quizTargets(question: QuizQuestion) {
  const correctChoices = question.choices.filter((choice) => choice.is_correct).map((choice) => choice.label);
  const answerTargets = answerValues(question.answer_key);
  const choiceTargets = question.choices.slice(0, 3).map((choice) => choice.label);
  return [...correctChoices, ...answerTargets, ...choiceTargets];
}


function titleWords(title: string) {
  return (title.match(/[A-Za-z0-9][A-Za-z0-9:+'-]{2,}/g) ?? []).slice(0, 4);
}


export function extractLessonGameTargets(
  lesson: LessonHistoryItem | null | undefined,
  fallbackWords: string[] = [],
): LessonGameTarget[] {
  const subject = lesson?.subject_title ?? "Lesson";
  const tier = lesson?.lesson_package?.tier;
  const targets: LessonGameTarget[] = [];
  const seen = new Set<string>();

  const structuredQuiz = lesson?.quiz ?? lesson?.lesson_package?.quiz ?? [];
  for (const question of structuredQuiz) {
    for (const target of quizTargets(question)) {
      addTarget(targets, seen, target, "quiz", subject, tier);
    }
  }

  if (lesson?.lesson_package) {
    for (const vocabulary of lesson.lesson_package.vocabulary) {
      addTarget(targets, seen, vocabulary.term, "vocabulary", subject, tier);
    }

    for (const example of lesson.lesson_package.worked_examples) {
      for (const word of titleWords(`${example.title} ${example.prompt}`)) {
        addTarget(targets, seen, word, "worked-example", subject, tier);
      }
    }
  }

  if (targets.length === 0 && lesson) {
    for (const word of lesson.vocabulary_words) {
      addTarget(targets, seen, word, "fallback", subject, tier);
    }

    for (const word of titleWords(`${lesson.title} ${lesson.leaf_title}`)) {
      addTarget(targets, seen, word, "lesson-title", subject, tier);
    }
  }

  if (targets.length === 0) {
    for (const word of fallbackWords) {
      addTarget(targets, seen, word, "fallback", subject, tier);
    }
  }

  return targets.slice(0, MAX_TARGETS);
}
