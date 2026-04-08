import { useEffect, useMemo, useState } from "react";

import type { LessonHistoryItem } from "../types/lesson";
import { buildLessonChallenge, normalizeAnswer, type LessonChallengeQuestion } from "../utils/challenge";


interface LessonChallengeModalProps {
  isOpen: boolean;
  isSubmitting: boolean;
  lesson: LessonHistoryItem | null;
  onClose: () => void;
  onPass: (result: { correctCount: number; questionCount: number }) => Promise<void>;
}

type AnswerMap = Record<string, string>;


function questionPrompt(question: LessonChallengeQuestion) {
  return question.prompt.split("\n");
}


export function LessonChallengeModal({
  isOpen,
  isSubmitting,
  lesson,
  onClose,
  onPass,
}: LessonChallengeModalProps) {
  const challenge = useMemo(() => (lesson ? buildLessonChallenge(lesson) : null), [lesson]);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [attemptCount, setAttemptCount] = useState(0);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !challenge) {
      setAnswers({});
      setAttemptCount(0);
      setFeedbackMessage(null);
      return;
    }

    const initialAnswers: AnswerMap = {};
    for (const question of challenge.questions) {
      initialAnswers[question.id] = "";
    }

    setAnswers(initialAnswers);
    setAttemptCount(0);
    setFeedbackMessage(null);
  }, [challenge, isOpen]);

  if (!isOpen || !lesson || !challenge) {
    return null;
  }

  const gradeCue =
    challenge.tier === "early"
      ? "Try the letters and words you just learned."
      : challenge.tier === "elementary"
      ? "Show what you understood from the lesson."
      : "Use the lesson details to answer carefully.";

  const allAnswered = challenge.questions.every((question) => normalizeAnswer(answers[question.id] ?? "").length > 0);

  const handleSubmit = async () => {
    let correctCount = 0;

    for (const question of challenge.questions) {
      const normalizedGiven = normalizeAnswer(answers[question.id] ?? "");
      const normalizedAnswer = normalizeAnswer(question.answer);
      if (normalizedGiven === normalizedAnswer) {
        correctCount += 1;
      }
    }

    if (correctCount >= challenge.passingScore) {
      setFeedbackMessage(`Great work. You got ${correctCount} out of ${challenge.questions.length}.`);
      await onPass({
        correctCount,
        questionCount: challenge.questions.length,
      });
      return;
    }

    if (attemptCount === 0) {
      setAttemptCount(1);
      setFeedbackMessage(
        `You got ${correctCount} out of ${challenge.questions.length}. Read the lesson one more time and try again.`,
      );
      return;
    }

    setFeedbackMessage(
      `You are close. Review the lesson and come back when you are ready for another try.`,
    );
  };

  return (
    <div className="lesson-challenge-overlay" role="dialog" aria-modal="true" aria-label={`${lesson.title} challenge`}>
      <article className="lesson-challenge-card">
        <div className="lesson-challenge-header">
          <div>
            <p className="lesson-kicker">Lesson Challenge</p>
            <h2>{lesson.title}</h2>
            <p className="lesson-reader-meta">{gradeCue}</p>
          </div>
          <button className="lesson-reader-close" type="button" onClick={onClose}>
            Back
          </button>
        </div>

        <div className="lesson-challenge-body">
          {challenge.questions.map((question, index) => (
            <section key={question.id} className="challenge-question-card">
              <p className="challenge-question-number">Question {index + 1}</p>
              <div className="challenge-question-prompt">
                {questionPrompt(question).map((line) => (
                  <p key={`${question.id}-${line}`}>{line}</p>
                ))}
              </div>

              {question.type === "multiple-choice" ? (
                <div className="challenge-choice-grid">
                  {question.choices.map((choice) => {
                    const isSelected = answers[question.id] === choice.label;
                    return (
                      <button
                        key={choice.id}
                        type="button"
                        className={isSelected ? "challenge-choice active" : "challenge-choice"}
                        onClick={() =>
                          setAnswers((currentAnswers) => ({
                            ...currentAnswers,
                            [question.id]: choice.label,
                          }))
                        }
                      >
                        {choice.label}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <label className="challenge-blank-field">
                  <span>Type your answer</span>
                  <input
                    type="text"
                    value={answers[question.id] ?? ""}
                    placeholder={question.placeholder}
                    onChange={(event) =>
                      setAnswers((currentAnswers) => ({
                        ...currentAnswers,
                        [question.id]: event.target.value,
                      }))
                    }
                  />
                </label>
              )}
            </section>
          ))}
        </div>

        <div className="lesson-challenge-footer">
          {feedbackMessage ? <p className="challenge-feedback">{feedbackMessage}</p> : null}
          <button
            className="grow-button"
            type="button"
            disabled={!allAnswered || isSubmitting}
            onClick={() => void handleSubmit()}
          >
            {isSubmitting ? "Saving..." : "Submit Challenge"}
          </button>
        </div>
      </article>
    </div>
  );
}
