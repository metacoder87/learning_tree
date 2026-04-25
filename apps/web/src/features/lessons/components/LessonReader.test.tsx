import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LessonReader } from "./LessonReader";
import type { ActiveLessonView } from "../types/lesson";


const lesson: ActiveLessonView = {
  id: 12,
  leaf_id: 4,
  leaf_title: "Counting",
  subject_title: "Math",
  grade_title: "Grade 1",
  title: "Counting",
  content: "## Story Start\nCount one leaf.\n\n## Try It\n- Count two leaves.",
  vocabulary_words: ["counting", "numbers", "practice", "example", "pattern"],
  is_completed: false,
  challenge_score: null,
  challenge_total: null,
  completed_at: null,
  created_at: "2026-04-24T12:00:00",
  stream_state: "complete",
};


afterEach(() => {
  cleanup();
});


describe("LessonReader", () => {
  it("opens the completion flow from a generated lesson", async () => {
    const onCompleteLesson = vi.fn();

    render(
      <LessonReader
        lesson={lesson}
        isCompletingLesson={false}
        isLessonCompleted={false}
        isOpen
        isWaitingForFirstToken={false}
        onClose={vi.fn()}
        onCompleteLesson={onCompleteLesson}
        onPlayRewardGame={vi.fn()}
        onSpeakText={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /complete lesson/i }));
    expect(onCompleteLesson).toHaveBeenCalled();
  });

  it("keeps fallback recovery visible", () => {
    render(
      <LessonReader
        lesson={{
          ...lesson,
          recovered: true,
          recovery_detail: "Ollama connection failed",
        }}
        isCompletingLesson={false}
        isLessonCompleted={false}
        isOpen
        isWaitingForFirstToken={false}
        onClose={vi.fn()}
        onCompleteLesson={vi.fn()}
        onPlayRewardGame={vi.fn()}
        onSpeakText={vi.fn()}
      />,
    );

    expect(screen.getByText(/local fallback lesson loaded/i)).toBeTruthy();
    expect(screen.getByText(/ollama connection failed/i)).toBeTruthy();
  });

  it("renders structured lesson package sections and vocabulary", () => {
    render(
      <LessonReader
        lesson={{
          ...lesson,
          lesson_package: {
            package_id: "pkg-1",
            curriculum_spec_id: "grade-6-math-ratios-v1",
            title: "Ratios",
            grade_title: "Grade 6",
            subject_title: "Math",
            tier: "middle",
            objective: "Use ratio language to compare two quantities.",
            generation_quality: "local_validated",
            sections: [
              { kind: "objective", title: "Objective", body: "Use ratio language to compare two quantities." },
              { kind: "hook", title: "Hook", body: "A recipe can scale up when every part changes by the same factor." },
            ],
            worked_examples: [
              {
                id: "worked-1",
                title: "Ratio example",
                prompt: "6 blue tiles and 3 green tiles",
                steps: ["Read 6:3", "Divide both parts by 3"],
                answer: "2:1",
                lesson_reference: "Worked Example",
              },
            ],
            guided_practice: [
              {
                id: "practice-1",
                prompt: "Simplify 4:6.",
                expected_response_hint: "Use the same factor on both parts.",
                lesson_reference: "Guided Practice",
              },
            ],
            vocabulary: [
              { term: "ratio", definition: "A comparison of two quantities." },
              { term: "equivalent", definition: "Having the same relationship." },
              { term: "factor", definition: "A number used to multiply another number." },
              { term: "table", definition: "A way to organize values." },
              { term: "rate", definition: "A comparison for one unit." },
            ],
            quiz: [],
            mastery_evidence: {
              can_do_statement: "I can explain equivalent ratios.",
              evidence_prompt: "Show one equivalent ratio.",
              mastery_threshold: 4,
            },
          },
        }}
        isCompletingLesson={false}
        isLessonCompleted={false}
        isOpen
        isWaitingForFirstToken={false}
        onClose={vi.fn()}
        onCompleteLesson={vi.fn()}
        onPlayRewardGame={vi.fn()}
        onSpeakText={vi.fn()}
      />,
    );

    expect(screen.getByText("Objective")).toBeTruthy();
    expect(screen.getByText(/6 blue tiles/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /ratio/i })).toBeTruthy();
  });
});
