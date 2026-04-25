import { describe, expect, it } from "vitest";

import type { LessonHistoryItem } from "../types/lesson";
import { extractLessonGameTargets } from "./gameTargets";


const structuredLesson: LessonHistoryItem = {
  id: 42,
  leaf_id: 12,
  leaf_title: "Ratios",
  subject_title: "Math",
  grade_title: "Grade 6",
  title: "Ratios",
  content: "Lesson text",
  vocabulary_words: ["legacy"],
  is_completed: false,
  challenge_score: null,
  challenge_total: null,
  completed_at: null,
  created_at: "2026-04-24T12:00:00",
  lesson_package: {
    package_id: "pkg",
    curriculum_spec_id: "grade-6-math-ratios-v1",
    title: "Ratios",
    grade_title: "Grade 6",
    subject_title: "Math",
    tier: "middle",
    objective: "Use ratio language to compare two quantities.",
    sections: [],
    worked_examples: [
      {
        id: "worked-1",
        title: "Ratio table",
        prompt: "A recipe doubles both quantities.",
        steps: ["Read the ratio", "Multiply both parts"],
        answer: "2:1 is equivalent to 6:3.",
        lesson_reference: "Worked Example",
      },
    ],
    guided_practice: [],
    vocabulary: [
      { term: "ratio", definition: "A comparison of two quantities." },
      { term: "equivalent", definition: "Having the same relationship." },
      { term: "factor", definition: "A number used to multiply." },
      { term: "table", definition: "Rows of related numbers." },
      { term: "rate", definition: "A comparison involving one unit." },
    ],
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
    ],
    mastery_evidence: {
      can_do_statement: "I can explain equivalent ratios.",
      evidence_prompt: "Show two equivalent ratios.",
      mastery_threshold: 4,
    },
    generation_quality: "local_validated",
  },
};


describe("extractLessonGameTargets", () => {
  it("prefers structured quiz and package targets over generic fallback words", () => {
    const targets = extractLessonGameTargets(structuredLesson, ["sun", "tree"]);

    expect(targets[0]).toMatchObject({ label: "2:1", source: "quiz", subject: "Math", tier: "middle" });
    expect(targets.some((target) => target.label === "ratio" && target.source === "vocabulary")).toBe(true);
    expect(targets.some((target) => target.label === "sun")).toBe(false);
  });

  it("uses fallback words only when no lesson targets are available", () => {
    const targets = extractLessonGameTargets(null, ["sun", "tree"]);

    expect(targets.map((target) => target.label)).toEqual(["sun", "tree"]);
    expect(targets.every((target) => target.source === "fallback")).toBe(true);
  });
});
