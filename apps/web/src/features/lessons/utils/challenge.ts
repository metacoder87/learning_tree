import type { LessonHistoryItem } from "../types/lesson";


export type LessonChallengeTier = "early" | "elementary" | "middle" | "high";

export interface LessonChallengeChoice {
  id: string;
  label: string;
}

export interface LessonChallengeMultipleChoiceQuestion {
  id: string;
  type: "multiple-choice";
  prompt: string;
  choices: LessonChallengeChoice[];
  answer: string;
}

export interface LessonChallengeFillBlankQuestion {
  id: string;
  type: "fill-blank";
  prompt: string;
  answer: string;
  placeholder: string;
}

export type LessonChallengeQuestion = LessonChallengeMultipleChoiceQuestion | LessonChallengeFillBlankQuestion;

export interface LessonChallengeSet {
  lessonId: number;
  tier: LessonChallengeTier;
  passingScore: number;
  questions: LessonChallengeQuestion[];
}

const STOPWORDS = new Set([
  "about",
  "after",
  "again",
  "also",
  "because",
  "before",
  "bring",
  "could",
  "every",
  "first",
  "from",
  "have",
  "into",
  "just",
  "learn",
  "lesson",
  "make",
  "many",
  "more",
  "most",
  "next",
  "only",
  "other",
  "really",
  "should",
  "start",
  "story",
  "their",
  "there",
  "these",
  "they",
  "this",
  "those",
  "through",
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
]);


function normalizeText(value: string) {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}


function hashValue(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}


function uniqWords(words: string[]) {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const word of words) {
    const normalized = word.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    unique.push(normalized);
  }

  return unique;
}


function sentenceList(content: string) {
  return normalizeText(content)
    .replace(/^##\s+/gm, "")
    .replace(/^- /gm, "")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 18);
}


function keywordPool(lesson: LessonHistoryItem) {
  const textWords = normalizeText(`${lesson.title} ${lesson.content}`)
    .toLowerCase()
    .match(/[a-z][a-z'-]{2,}/g);

  return uniqWords([
    ...lesson.vocabulary_words.map((word) => word.toLowerCase()),
    ...(textWords ?? []).filter((word) => !STOPWORDS.has(word)),
    "pattern",
    "example",
    "reason",
    "detail",
  ]);
}


function titleWords(title: string) {
  return uniqWords(
    (title.toLowerCase().match(/[a-z][a-z'-]{1,}/g) ?? []).filter((word) => !STOPWORDS.has(word)),
  );
}


export function gradeTierFromTitle(gradeTitle: string): LessonChallengeTier {
  const normalized = gradeTitle.trim().toLowerCase();
  if (normalized === "pre-k" || normalized === "kindergarten" || normalized === "grade 1") {
    return "early";
  }

  const gradeMatch = normalized.match(/grade\s+(\d+)/);
  const gradeNumber = gradeMatch ? Number(gradeMatch[1]) : null;

  if (gradeNumber !== null) {
    if (gradeNumber <= 5) {
      return "elementary";
    }
    if (gradeNumber <= 8) {
      return "middle";
    }
  }

  return "high";
}


function buildChoiceSet(answer: string, pool: string[], count: number, seed: number) {
  const distractors = pool.filter((word) => word !== answer);
  const picked = [answer];

  for (let index = 0; index < distractors.length && picked.length < count; index += 1) {
    const candidate = distractors[(index + seed) % distractors.length];
    if (!picked.includes(candidate)) {
      picked.push(candidate);
    }
  }

  return picked
    .sort((left, right) => hashValue(`${left}-${seed}`) - hashValue(`${right}-${seed}`))
    .map((word, index) => ({
      id: `${answer}-${index}`,
      label: word,
    }));
}


function replaceWordWithBlank(sentence: string, answer: string) {
  const pattern = new RegExp(`\\b${answer.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  if (!pattern.test(sentence)) {
    return null;
  }

  return sentence.replace(pattern, "_____");
}


function candidateWordsFromSentence(sentence: string, tier: LessonChallengeTier) {
  const minimumLength = tier === "early" ? 2 : 4;
  return uniqWords(
    (sentence.toLowerCase().match(/[a-z][a-z'-]{1,}/g) ?? []).filter(
      (word) => word.length >= minimumLength && !STOPWORDS.has(word),
    ),
  );
}


function buildEarlyQuestions(lesson: LessonHistoryItem, pool: string[]) {
  const baseWords = uniqWords([...lesson.vocabulary_words, ...titleWords(lesson.title)]).slice(0, 4);
  const primaryWord = baseWords[0] ?? lesson.title.split(" ")[0].toLowerCase();
  const secondWord = baseWords[1] ?? baseWords[0] ?? "tree";

  return [
    {
      id: `mcq-${lesson.id}-0`,
      type: "multiple-choice",
      prompt: `Which word belongs to your lesson about ${lesson.title.toLowerCase()}?`,
      choices: buildChoiceSet(primaryWord, pool, 3, lesson.id),
      answer: primaryWord,
    } satisfies LessonChallengeMultipleChoiceQuestion,
    {
      id: `blank-${lesson.id}-1`,
      type: "fill-blank",
      prompt: `Type the first letter in the word "${primaryWord}".`,
      answer: primaryWord.charAt(0),
      placeholder: "One letter",
    } satisfies LessonChallengeFillBlankQuestion,
    {
      id: `mcq-${lesson.id}-2`,
      type: "multiple-choice",
      prompt: `Which word did you practice in this lesson?`,
      choices: buildChoiceSet(secondWord, pool, 3, lesson.id + 3),
      answer: secondWord,
    } satisfies LessonChallengeMultipleChoiceQuestion,
  ];
}


function buildSentenceQuestions(lesson: LessonHistoryItem, tier: LessonChallengeTier, pool: string[]) {
  const sentences = sentenceList(lesson.content);
  const desiredCount = tier === "elementary" ? 4 : 5;
  const questions: LessonChallengeQuestion[] = [];

  for (let sentenceIndex = 0; sentenceIndex < sentences.length && questions.length < desiredCount; sentenceIndex += 1) {
    const sentence = sentences[sentenceIndex];
    const candidates = candidateWordsFromSentence(sentence, tier);
    const answer = candidates[0];
    if (!answer) {
      continue;
    }

    const blankPrompt = replaceWordWithBlank(sentence, answer);
    if (blankPrompt) {
      questions.push({
        id: `blank-${lesson.id}-${sentenceIndex}`,
        type: "fill-blank",
        prompt: blankPrompt,
        answer,
        placeholder: tier === "elementary" ? "Type one word" : "Type the missing term",
      });
    }

    if (questions.length >= desiredCount) {
      break;
    }

    questions.push({
      id: `mcq-${lesson.id}-${sentenceIndex}`,
      type: "multiple-choice",
      prompt: `Which word best completes this idea from the lesson?\n${blankPrompt ?? sentence}`,
      choices: buildChoiceSet(answer, pool, 4, lesson.id + sentenceIndex),
      answer,
    });
  }

  while (questions.length < desiredCount) {
    const fallbackWord = pool[(lesson.id + questions.length) % pool.length] ?? "idea";
    if (questions.length % 2 === 0) {
      questions.push({
        id: `fallback-${lesson.id}-${questions.length}`,
        type: "multiple-choice",
        prompt: "Which word fits this lesson best?",
        choices: buildChoiceSet(fallbackWord, pool, 4, lesson.id + questions.length),
        answer: fallbackWord,
      });
      continue;
    }

    questions.push({
      id: `fallback-${lesson.id}-${questions.length}`,
      type: "fill-blank",
      prompt: `Type the lesson word that best matches this topic: ${lesson.title.toLowerCase()}.`,
      answer: fallbackWord,
      placeholder: "Type one word",
    });
  }

  return questions.slice(0, desiredCount);
}


function passingScore(questionCount: number, tier: LessonChallengeTier) {
  if (tier === "early") {
    return Math.max(2, questionCount - 1);
  }

  if (tier === "elementary") {
    return Math.max(3, questionCount - 1);
  }

  return Math.max(4, questionCount - 1);
}


export function buildLessonChallenge(lesson: LessonHistoryItem): LessonChallengeSet {
  const tier = gradeTierFromTitle(lesson.grade_title);
  const pool = keywordPool(lesson);
  const questions =
    tier === "early"
      ? buildEarlyQuestions(lesson, pool)
      : buildSentenceQuestions(lesson, tier, pool);

  return {
    lessonId: lesson.id,
    tier,
    passingScore: passingScore(questions.length, tier),
    questions,
  };
}


export function normalizeAnswer(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}
