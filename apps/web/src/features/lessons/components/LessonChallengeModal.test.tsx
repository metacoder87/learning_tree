import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LessonChallengeModal } from "./LessonChallengeModal";
import type { LessonCompletionResponse, LessonHistoryItem } from "../types/lesson";


const structuredLesson: LessonHistoryItem = {
  id: 21,
  leaf_id: 8,
  leaf_title: "Ratios",
  subject_title: "Math",
  grade_title: "Grade 6",
  title: "Ratios",
  content: "Structured lesson text.",
  vocabulary_words: ["ratio", "equivalent", "factor", "table", "rate"],
  is_completed: false,
  challenge_score: null,
  challenge_total: null,
  completed_at: null,
  created_at: "2026-04-24T12:00:00",
  quiz: [
    {
      id: "q1",
      type: "multiple-choice",
      prompt: "What is 6:3 simplified?",
      choices: [
        { id: "one-two", label: "1:2" },
        { id: "two-one", label: "2:1", is_correct: true },
      ],
      categories: [],
      answer_key: "2:1",
      explanation: "Divide both parts by 3.",
      lesson_reference: "Worked Example",
    },
    {
      id: "q2",
      type: "fill-blank",
      prompt: "4:6 is equivalent to ____.",
      choices: [],
      categories: [],
      answer_key: "2:3",
      explanation: "Divide both parts by 2.",
      lesson_reference: "Direct Teaching",
    },
  ],
};


afterEach(() => {
  cleanup();
});


describe("LessonChallengeModal", () => {
  it("submits backend-provided quiz answers and renders feedback", async () => {
    const response: LessonCompletionResponse = {
      lesson: structuredLesson,
      mastery_level: 0,
      lessons_completed: 0,
      completed_now: false,
      score: 1,
      total: 2,
      passed: false,
      passing_score: 2,
      feedback: [
        {
          question_id: "q1",
          is_correct: true,
          correct_answer: "2:1",
          explanation: "Divide both parts by 3.",
          lesson_reference: "Worked Example",
        },
      ],
    };
    const onPass = vi.fn().mockResolvedValue(response);

    render(
      <LessonChallengeModal
        isOpen
        isSubmitting={false}
        lesson={structuredLesson}
        onClose={vi.fn()}
        onClaimReward={vi.fn()}
        onPass={onPass}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "2:1" }));
    await userEvent.type(screen.getByLabelText(/type your answer/i), "2:3");
    await userEvent.click(screen.getByRole("button", { name: /submit challenge/i }));

    await waitFor(() => expect(onPass).toHaveBeenCalled());
    expect(onPass.mock.calls[0][0]).toEqual({
      answers: [
        { question_id: "q1", value: "2:1" },
        { question_id: "q2", value: "2:3" },
      ],
    });
    expect(await screen.findByText(/you got 1 out of 2/i)).toBeTruthy();
    expect(screen.getByText(/divide both parts by 3/i)).toBeTruthy();
  });

  it("shows feedback and waits for reward claim after a passed backend quiz", async () => {
    const onClaimReward = vi.fn();
    const response: LessonCompletionResponse = {
      lesson: { ...structuredLesson, is_completed: true, challenge_score: 2, challenge_total: 2 },
      mastery_level: 1,
      lessons_completed: 1,
      completed_now: true,
      score: 2,
      total: 2,
      passed: true,
      passing_score: 2,
      feedback: [
        {
          question_id: "q1",
          is_correct: true,
          correct_answer: "2:1",
          explanation: "Divide both parts by 3.",
          lesson_reference: "Worked Example",
        },
        {
          question_id: "q2",
          is_correct: true,
          correct_answer: "2:3",
          explanation: "Divide both parts by 2.",
          lesson_reference: "Direct Teaching",
        },
      ],
    };
    const onPass = vi.fn().mockResolvedValue(response);

    render(
      <LessonChallengeModal
        isOpen
        isSubmitting={false}
        lesson={structuredLesson}
        onClose={vi.fn()}
        onClaimReward={onClaimReward}
        onPass={onPass}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "2:1" }));
    await userEvent.type(screen.getByLabelText(/type your answer/i), "2:3");
    await userEvent.click(screen.getByRole("button", { name: /submit challenge/i }));

    expect(await screen.findByText(/challenge passed: 2 out of 2/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /submit challenge/i })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /claim reward/i }));

    expect(onClaimReward).toHaveBeenCalledTimes(1);
  });
});
