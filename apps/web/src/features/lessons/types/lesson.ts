export interface GeneratedLesson {
  title: string;
  content: string;
  vocabulary_words: string[];
}

export type LessonTier = "early" | "elementary" | "middle" | "high";
export type QuizQuestionType = "multiple-choice" | "fill-blank" | "sequence" | "classify" | "short-response";
export type QuizAnswerValue = string | string[] | Record<string, string>;

export interface VocabularyTerm {
  term: string;
  definition: string;
}

export interface LessonSection {
  kind:
    | "objective"
    | "hook"
    | "direct-teaching"
    | "worked-example"
    | "guided-practice"
    | "common-mistake"
    | "independent-check"
    | "recap";
  title: string;
  body: string;
}

export interface WorkedExample {
  id: string;
  title: string;
  prompt: string;
  steps: string[];
  answer: string;
  lesson_reference: string;
}

export interface PracticePrompt {
  id: string;
  prompt: string;
  expected_response_hint: string;
  lesson_reference: string;
}

export interface QuizChoice {
  id: string;
  label: string;
  is_correct?: boolean;
}

export interface QuizQuestion {
  id: string;
  type: QuizQuestionType;
  prompt: string;
  choices: QuizChoice[];
  categories: string[];
  answer_key?: QuizAnswerValue | null;
  explanation: string;
  lesson_reference: string;
}

export interface MasteryEvidence {
  can_do_statement: string;
  evidence_prompt: string;
  mastery_threshold: number;
}

export interface LessonPackage {
  package_id: string;
  curriculum_spec_id: string;
  title: string;
  grade_title: string;
  subject_title: string;
  tier: LessonTier;
  objective: string;
  sections: LessonSection[];
  worked_examples: WorkedExample[];
  guided_practice: PracticePrompt[];
  vocabulary: VocabularyTerm[];
  quiz: QuizQuestion[];
  mastery_evidence: MasteryEvidence;
  generation_quality: string;
}

export interface LessonHistoryItem {
  id: number;
  leaf_id: number;
  leaf_title: string;
  subject_title: string;
  grade_title: string;
  title: string;
  content: string;
  vocabulary_words: string[];
  is_completed: boolean;
  challenge_score?: number | null;
  challenge_total?: number | null;
  completed_at?: string | null;
  created_at: string;
  recovered?: boolean;
  recovery_detail?: string | null;
  stream_model?: string | null;
  lesson_package?: LessonPackage | null;
  quiz?: QuizQuestion[] | null;
  mastery_evidence?: MasteryEvidence | null;
  curriculum_spec_id?: string | null;
  generation_quality?: string | null;
}

export type LessonStreamState = "idle" | "waiting" | "streaming" | "complete";

export interface ActiveLessonView extends LessonHistoryItem {
  stream_state?: LessonStreamState;
  stream_model?: string | null;
  recovered?: boolean;
  recovery_detail?: string | null;
}

export interface QuizAnswerSubmission {
  question_id: string;
  value: QuizAnswerValue;
}

export interface QuizFeedback {
  question_id: string;
  is_correct: boolean;
  correct_answer: string;
  explanation: string;
  lesson_reference: string;
}

export interface LessonCompletionResponse {
  lesson: LessonHistoryItem;
  mastery_level: number;
  lessons_completed: number;
  completed_now: boolean;
  score: number;
  total: number;
  passed: boolean;
  passing_score: number;
  feedback: QuizFeedback[];
}
