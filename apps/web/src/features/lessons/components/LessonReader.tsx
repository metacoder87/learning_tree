import type { ActiveLessonView } from "../types/lesson";


interface LessonReaderProps {
  lesson: ActiveLessonView | null;
  isOpen: boolean;
  isWaitingForFirstToken: boolean;
  onClose: () => void;
  onSpeakText: (text: string) => void;
}

type LessonBlock =
  | {
      type: "heading";
      text: string;
    }
  | {
      type: "paragraph";
      text: string;
    }
  | {
      type: "list";
      items: string[];
    };


function parseLessonBlocks(content: string): LessonBlock[] {
  const normalized = content.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!normalized) {
    return [];
  }

  const lines = normalized.split("\n");
  const blocks: LessonBlock[] = [];
  let paragraphBuffer: string[] = [];
  let listBuffer: string[] = [];

  const flushParagraph = () => {
    if (paragraphBuffer.length === 0) {
      return;
    }

    blocks.push({
      type: "paragraph",
      text: paragraphBuffer.join(" ").trim(),
    });
    paragraphBuffer = [];
  };

  const flushList = () => {
    if (listBuffer.length === 0) {
      return;
    }

    blocks.push({
      type: "list",
      items: [...listBuffer],
    });
    listBuffer = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    if (line.startsWith("## ")) {
      flushParagraph();
      flushList();
      blocks.push({
        type: "heading",
        text: line.slice(3).trim(),
      });
      continue;
    }

    if (line.startsWith("- ")) {
      flushParagraph();
      listBuffer.push(line.slice(2).trim());
      continue;
    }

    flushList();
    paragraphBuffer.push(line);
  }

  flushParagraph();
  flushList();
  return blocks;
}


export function LessonReader({
  lesson,
  isOpen,
  isWaitingForFirstToken,
  onClose,
  onSpeakText,
}: LessonReaderProps) {
  if (!isOpen || !lesson) {
    return null;
  }

  const blocks = parseLessonBlocks(lesson.content);
  const canReadFullLesson = lesson.content.trim().length > 0;

  return (
    <div className="lesson-reader-overlay" role="dialog" aria-modal="true" aria-label={lesson.title}>
      <article className="lesson-reader-card">
        <div className="lesson-reader-header">
          <div>
            <p className="lesson-kicker">Lesson View</p>
            <h2>{lesson.title}</h2>
            <p className="lesson-reader-meta">
              {lesson.grade_title} | {lesson.subject_title} | {lesson.leaf_title}
            </p>
          </div>
          <button className="lesson-reader-close" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="lesson-reader-body">
          {isWaitingForFirstToken ? (
            <div className="lesson-reader-loading">
              <div className="lesson-spinner" aria-hidden="true" />
              <p>Gathering your lesson...</p>
            </div>
          ) : null}

          {!isWaitingForFirstToken && blocks.length === 0 ? (
            <p className="lesson-reader-paragraph">Your lesson will appear here.</p>
          ) : null}

          {blocks.map((block, index) => {
            if (block.type === "heading") {
              return (
                <h3 key={`${lesson.id}-heading-${index}`} className="lesson-reader-section">
                  {block.text}
                </h3>
              );
            }

            if (block.type === "list") {
              return (
                <ul key={`${lesson.id}-list-${index}`} className="lesson-reader-list">
                  {block.items.map((item) => (
                    <li key={`${lesson.id}-${index}-${item}`}>{item}</li>
                  ))}
                </ul>
              );
            }

            return (
              <p key={`${lesson.id}-paragraph-${index}`} className="lesson-reader-paragraph">
                {block.text}
              </p>
            );
          })}
        </div>

        <div className="lesson-reader-footer">
          <button
            className="read-button"
            type="button"
            disabled={!canReadFullLesson}
            onClick={() => onSpeakText(`${lesson.title}. ${lesson.content}`)}
          >
            Read Full Lesson
          </button>

          {lesson.vocabulary_words.length > 0 ? (
            <div className="vocabulary-chip-row">
              {lesson.vocabulary_words.map((word) => (
                <button key={word} type="button" className="vocabulary-chip" onClick={() => onSpeakText(word)}>
                  {word}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </article>
    </div>
  );
}
