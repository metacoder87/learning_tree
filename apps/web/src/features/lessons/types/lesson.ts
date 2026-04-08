export interface GeneratedLesson {
  title: string;
  content: string;
  vocabulary_words: string[];
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
}

export type LessonStreamState = "idle" | "waiting" | "streaming" | "complete";

export interface ActiveLessonView extends LessonHistoryItem {
  stream_state?: LessonStreamState;
  stream_model?: string | null;
  recovered?: boolean;
}
