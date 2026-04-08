import type { LessonHistoryItem } from "../../lessons/types/lesson";
import type { LeafNode } from "../types/tree";


interface CurrentLeafOverlayProps {
  errorMessage: string | null;
  isGeneratingLesson: boolean;
  lesson: LessonHistoryItem | null;
  leaf: LeafNode | null;
  onClose: () => void;
  onOpenLesson: () => void;
  onReadToMe: () => void;
  onSpeakText: (text: string) => void;
  onStartLesson: () => void;
}


function previewText(lesson: LessonHistoryItem | null, leaf: LeafNode) {
  const source = lesson?.content ?? leaf.previewText;
  if (source.length <= 200) {
    return source;
  }

  return `${source.slice(0, 197).trim()}...`;
}


export function CurrentLeafOverlay({
  errorMessage,
  isGeneratingLesson,
  lesson,
  leaf,
  onClose,
  onOpenLesson,
  onReadToMe,
  onSpeakText,
  onStartLesson,
}: CurrentLeafOverlayProps) {
  if (!leaf) {
    return null;
  }

  const hasOpenedLesson = Boolean(lesson?.content.trim());
  const shouldShowGeneratingCopy = isGeneratingLesson && !hasOpenedLesson;

  return (
    <section className="current-leaf-overlay" aria-label={`${leaf.title} controls`}>
      <article className="current-leaf-card">
        <button className="current-leaf-close" type="button" aria-label="Close current leaf" onClick={onClose}>
          X
        </button>

        <p className="lesson-kicker">Current Leaf</p>
        <h2
          onFocus={() => onSpeakText(leaf.title)}
          onMouseEnter={() => onSpeakText(leaf.title)}
          onTouchStart={() => onSpeakText(leaf.title)}
          tabIndex={0}
        >
          {leaf.title}
        </h2>
        <p className="current-leaf-meta">
          {leaf.gradeTitle ?? "Grade"} | {leaf.subjectTitle ?? "Subject"}
        </p>

        <p className={errorMessage ? "current-leaf-copy error" : "current-leaf-copy"}>
          {errorMessage ?? (shouldShowGeneratingCopy ? "Your lesson is starting..." : previewText(lesson, leaf))}
        </p>

        <div className="current-leaf-actions">
          <button className="grow-button" type="button" onClick={onStartLesson} disabled={isGeneratingLesson}>
            {isGeneratingLesson ? "Generating..." : "Start Lesson"}
          </button>
          <button className="read-button" type="button" onClick={onReadToMe}>
            Read to Me
          </button>
          {hasOpenedLesson ? (
            <button className="grow-button secondary" type="button" onClick={onOpenLesson}>
              Open Lesson
            </button>
          ) : null}
        </div>

        {lesson && lesson.vocabulary_words.length > 0 ? (
          <div className="vocabulary-chip-row">
            {lesson.vocabulary_words.map((word) => (
              <button key={word} type="button" className="vocabulary-chip" onClick={() => onSpeakText(word)}>
                {word}
              </button>
            ))}
          </div>
        ) : null}
      </article>
    </section>
  );
}
