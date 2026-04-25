import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";

import type {
  LessonCompletionResponse,
  LessonHistoryItem,
  QuizAnswerSubmission,
  QuizAnswerValue,
  QuizFeedback,
  QuizQuestion,
} from "../types/lesson";
import { buildLessonChallenge, normalizeAnswer, type LessonChallengeQuestion } from "../utils/challenge";


interface LessonChallengeModalProps {
  isOpen: boolean;
  isSubmitting: boolean;
  lesson: LessonHistoryItem | null;
  onClose: () => void;
  onClaimReward: () => void;
  onPass: (result: LessonChallengeSubmitPayload) => Promise<LessonCompletionResponse | void>;
}

export type LessonChallengeSubmitPayload =
  | { correctCount: number; questionCount: number }
  | { answers: QuizAnswerSubmission[] };

type AnswerMap = Record<string, QuizAnswerValue>;


function questionPrompt(question: LessonChallengeQuestion | QuizQuestion) {
  return question.prompt.split("\n");
}


function isNonEmptyAnswer(value: QuizAnswerValue | undefined, question?: QuizQuestion) {
  if (typeof value === "string") {
    return normalizeAnswer(value).length > 0;
  }

  if (Array.isArray(value)) {
    return value.every((item) => normalizeAnswer(item).length > 0);
  }

  if (value && question?.type === "classify") {
    return question.choices.every((choice) => normalizeAnswer(value[choice.label] ?? value[choice.id] ?? "").length > 0);
  }

  return false;
}


function answerValueForQuestion(question: QuizQuestion, answers: AnswerMap): QuizAnswerValue {
  const answer = answers[question.id];
  if (question.type === "classify" && typeof answer === "object" && answer !== null && !Array.isArray(answer)) {
    return answer;
  }
  if (question.type === "sequence" && Array.isArray(answer)) {
    return answer;
  }
  return typeof answer === "string" ? answer : "";
}


function buildInitialAnswers(questions: QuizQuestion[]) {
  const initialAnswers: AnswerMap = {};
  for (const question of questions) {
    if (question.type === "sequence") {
      initialAnswers[question.id] = Array.from({ length: question.choices.length }, () => "");
      continue;
    }
    if (question.type === "classify") {
      initialAnswers[question.id] = {};
      continue;
    }
    initialAnswers[question.id] = "";
  }
  return initialAnswers;
}


export function LessonChallengeModal({
  isOpen,
  isSubmitting,
  lesson,
  onClose,
  onClaimReward,
  onPass,
}: LessonChallengeModalProps) {
  const backendQuestions = lesson?.quiz?.length ? lesson.quiz : lesson?.lesson_package?.quiz ?? null;
  const legacyChallenge = useMemo(
    () => (lesson && !backendQuestions ? buildLessonChallenge(lesson) : null),
    [backendQuestions, lesson],
  );
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [attemptCount, setAttemptCount] = useState(0);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [questionFeedback, setQuestionFeedback] = useState<QuizFeedback[]>([]);
  const [passedResponse, setPassedResponse] = useState<LessonCompletionResponse | null>(null);
  const lessonChallengeKey = lesson?.id ?? null;

  useEffect(() => {
    if (!isOpen) {
      setAnswers({});
      setAttemptCount(0);
      setFeedbackMessage(null);
      setQuestionFeedback([]);
      setPassedResponse(null);
      return;
    }

    if (backendQuestions) {
      setAnswers(buildInitialAnswers(backendQuestions));
      setAttemptCount(0);
      setFeedbackMessage(null);
      setQuestionFeedback([]);
      setPassedResponse(null);
      return;
    }

    if (legacyChallenge) {
      const initialAnswers: AnswerMap = {};
      for (const question of legacyChallenge.questions) {
        initialAnswers[question.id] = "";
      }
      setAnswers(initialAnswers);
      setAttemptCount(0);
      setFeedbackMessage(null);
      setQuestionFeedback([]);
      setPassedResponse(null);
    }
  }, [isOpen, lessonChallengeKey]);

  if (!isOpen || !lesson) {
    return null;
  }

  const gradeCue =
    lesson.lesson_package?.tier === "early" || legacyChallenge?.tier === "early"
      ? "Try the words, objects, or steps you just learned."
      : lesson.lesson_package?.tier === "elementary" || legacyChallenge?.tier === "elementary"
      ? "Use the example from the lesson."
      : "Use evidence and the lesson details carefully.";

  const allAnswered = backendQuestions
    ? backendQuestions.every((question) => isNonEmptyAnswer(answers[question.id], question))
    : legacyChallenge?.questions.every((question) => isNonEmptyAnswer(answers[question.id])) ?? false;

  const handleStructuredSubmit = async (questions: QuizQuestion[]) => {
    const response = await onPass({
      answers: questions.map((question) => ({
        question_id: question.id,
        value: answerValueForQuestion(question, answers),
      })),
    });

    if (response) {
      setQuestionFeedback(response.feedback);
      setPassedResponse(response.passed ? response : null);
      setFeedbackMessage(
        response.passed
          ? `Challenge passed: ${response.score} out of ${response.total}.`
          : `You got ${response.score} out of ${response.total}. You need ${response.passing_score} to complete this leaf.`,
      );
      setAttemptCount((currentCount) => currentCount + 1);
    }
  };

  const handleLegacySubmit = async () => {
    if (!legacyChallenge) {
      return;
    }

    let correctCount = 0;

    for (const question of legacyChallenge.questions) {
      const normalizedGiven = normalizeAnswer(String(answers[question.id] ?? ""));
      const normalizedAnswer = normalizeAnswer(question.answer);
      if (normalizedGiven === normalizedAnswer) {
        correctCount += 1;
      }
    }

    if (correctCount >= legacyChallenge.passingScore) {
      const response = await onPass({
        correctCount,
        questionCount: legacyChallenge.questions.length,
      });
      if (response?.passed) {
        setPassedResponse(response);
        setFeedbackMessage(`Challenge passed: ${response.score} out of ${response.total}.`);
        return;
      }
      setFeedbackMessage(`Great work. You got ${correctCount} out of ${legacyChallenge.questions.length}.`);
      return;
    }

    if (attemptCount === 0) {
      setAttemptCount(1);
      setFeedbackMessage(
        `You got ${correctCount} out of ${legacyChallenge.questions.length}. Read the lesson one more time and try again.`,
      );
      return;
    }

    setFeedbackMessage("You are close. Review the lesson and come back when you are ready for another try.");
  };

  const handleSubmit = async () => {
    if (backendQuestions) {
      await handleStructuredSubmit(backendQuestions);
      return;
    }

    await handleLegacySubmit();
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
          {backendQuestions
            ? backendQuestions.map((question, index) => (
                <StructuredQuestion
                  key={question.id}
                  answer={answers[question.id]}
                  feedback={questionFeedback.find((item) => item.question_id === question.id)}
                  index={index}
                  question={question}
                  setAnswers={setAnswers}
                />
              ))
            : legacyChallenge?.questions.map((question, index) => (
                <LegacyQuestion
                  key={question.id}
                  answer={String(answers[question.id] ?? "")}
                  index={index}
                  question={question}
                  setAnswers={setAnswers}
                />
              ))}
        </div>

        <div className="lesson-challenge-footer">
          {feedbackMessage ? <p className="challenge-feedback">{feedbackMessage}</p> : null}
          {passedResponse ? (
            <button className="grow-button" type="button" onClick={onClaimReward}>
              Claim Reward
            </button>
          ) : (
            <button
              className="grow-button"
              type="button"
              disabled={!allAnswered || isSubmitting}
              onClick={() => void handleSubmit()}
            >
              {isSubmitting ? "Saving..." : "Submit Challenge"}
            </button>
          )}
        </div>
      </article>
    </div>
  );
}


function StructuredQuestion({
  answer,
  feedback,
  index,
  question,
  setAnswers,
}: {
  answer: QuizAnswerValue | undefined;
  feedback?: QuizFeedback;
  index: number;
  question: QuizQuestion;
  setAnswers: Dispatch<SetStateAction<AnswerMap>>;
}) {
  return (
    <section className="challenge-question-card">
      <p className="challenge-question-number">Question {index + 1}</p>
      <div className="challenge-question-prompt">
        {questionPrompt(question).map((line) => (
          <p key={`${question.id}-${line}`}>{line}</p>
        ))}
      </div>

      {question.type === "multiple-choice" ? (
        <div className="challenge-choice-grid">
          {question.choices.map((choice) => {
            const isSelected = answer === choice.label || answer === choice.id;
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
      ) : null}

      {question.type === "fill-blank" || question.type === "short-response" ? (
        <label className="challenge-blank-field">
          <span>{question.type === "short-response" ? "Write a short answer" : "Type your answer"}</span>
          <textarea
            rows={question.type === "short-response" ? 3 : 1}
            value={typeof answer === "string" ? answer : ""}
            onChange={(event) =>
              setAnswers((currentAnswers) => ({
                ...currentAnswers,
                [question.id]: event.target.value,
              }))
            }
          />
        </label>
      ) : null}

      {question.type === "sequence" ? (
        <div className="challenge-sequence-list">
          {question.choices.map((_choice, orderIndex) => (
            <label key={`${question.id}-slot-${orderIndex}`} className="challenge-select-field">
              <span>Step {orderIndex + 1}</span>
              <select
                value={Array.isArray(answer) ? answer[orderIndex] ?? "" : ""}
                onChange={(event) =>
                  setAnswers((currentAnswers) => {
                    const currentValue = Array.isArray(currentAnswers[question.id])
                      ? [...(currentAnswers[question.id] as string[])]
                      : Array.from({ length: question.choices.length }, () => "");
                    currentValue[orderIndex] = event.target.value;
                    return {
                      ...currentAnswers,
                      [question.id]: currentValue,
                    };
                  })
                }
              >
                <option value="">Choose</option>
                {question.choices.map((choice) => (
                  <option key={choice.id} value={choice.label}>
                    {choice.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      ) : null}

      {question.type === "classify" ? (
        <div className="challenge-classify-grid">
          {question.choices.map((choice) => (
            <label key={choice.id} className="challenge-select-field">
              <span>{choice.label}</span>
              <select
                value={typeof answer === "object" && answer !== null && !Array.isArray(answer) ? answer[choice.label] ?? "" : ""}
                onChange={(event) =>
                  setAnswers((currentAnswers) => {
                    const currentValue =
                      typeof currentAnswers[question.id] === "object" &&
                      currentAnswers[question.id] !== null &&
                      !Array.isArray(currentAnswers[question.id])
                        ? { ...(currentAnswers[question.id] as Record<string, string>) }
                        : {};
                    currentValue[choice.label] = event.target.value;
                    return {
                      ...currentAnswers,
                      [question.id]: currentValue,
                    };
                  })
                }
              >
                <option value="">Choose</option>
                {question.categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      ) : null}

      {feedback ? (
        <div className={feedback.is_correct ? "challenge-answer-feedback correct" : "challenge-answer-feedback"}>
          <strong>{feedback.is_correct ? "Correct" : "Review"}</strong>
          <span>Answer: {feedback.correct_answer}</span>
          <span>{feedback.explanation}</span>
          <span>Lesson: {feedback.lesson_reference}</span>
        </div>
      ) : null}
    </section>
  );
}


function LegacyQuestion({
  answer,
  index,
  question,
  setAnswers,
}: {
  answer: string;
  index: number;
  question: LessonChallengeQuestion;
  setAnswers: Dispatch<SetStateAction<AnswerMap>>;
}) {
  return (
    <section className="challenge-question-card">
      <p className="challenge-question-number">Question {index + 1}</p>
      <div className="challenge-question-prompt">
        {questionPrompt(question).map((line) => (
          <p key={`${question.id}-${line}`}>{line}</p>
        ))}
      </div>

      {question.type === "multiple-choice" ? (
        <div className="challenge-choice-grid">
          {question.choices.map((choice) => {
            const isSelected = answer === choice.label;
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
            value={answer}
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
  );
}
