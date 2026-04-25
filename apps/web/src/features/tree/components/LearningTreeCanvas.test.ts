import { describe, expect, it } from "vitest";

import { branchHealthState, gradeVisualRules, masteryRejuvenationState, subjectVisualTheme } from "./LearningTreeCanvas";
import type { SubjectBranchNode } from "../types/tree";


describe("gradeVisualRules", () => {
  it("makes early grades larger and simpler than high grades", () => {
    const early = gradeVisualRules({ title: "Pre-K", sortOrder: 0 });
    const high = gradeVisualRules({ title: "Grade 12", sortOrder: 13 });

    expect(early.tier).toBe("early");
    expect(high.tier).toBe("high");
    expect(early.leafScale).toBeGreaterThan(high.leafScale);
    expect(high.canopyPuffCount).toBeGreaterThan(early.canopyPuffCount);
    expect(high.detailTwigCount).toBeGreaterThan(early.detailTwigCount);
  });
});


describe("rejuvenation visuals", () => {
  it("maps mastery from dark decay to bright shining green", () => {
    const decayed = masteryRejuvenationState(0);
    const radiant = masteryRejuvenationState(5);

    expect(decayed.stage).toBe("decayed");
    expect(decayed.color).toBe("#211711");
    expect(decayed.decay).toBe(1);
    expect(radiant.stage).toBe("radiant-green");
    expect(radiant.color).toBe("#78ff5d");
    expect(radiant.glow).toBe(true);
    expect(radiant.emissiveIntensity).toBeGreaterThan(decayed.emissiveIntensity);
  });

  it("derives branch health from aggregate leaf mastery", () => {
    const branch = {
      id: 1,
      title: "Math",
      subjectKey: "math",
      colorHex: "#88cc55",
      anchorX: 0,
      anchorY: 0,
      controlX: 0,
      controlY: 0,
      leaves: [
        { id: 1, title: "A", subtopicKey: "a", x: 0, y: 0, radius: 1, hitRadius: 1, masteryLevel: 0, previewText: "A" },
        { id: 2, title: "B", subtopicKey: "b", x: 0, y: 0, radius: 1, hitRadius: 1, masteryLevel: 5, previewText: "B" },
      ],
    } satisfies SubjectBranchNode;

    const health = branchHealthState(branch);

    expect(health.averageMastery).toBe(2.5);
    expect(health.healthRatio).toBe(0.5);
    expect(health.state).toBe("recovering");
  });

  it("returns distinct subject motifs", () => {
    expect(subjectVisualTheme("math").motif).toBe("number-bead");
    expect(subjectVisualTheme("reading").motif).toBe("letter-petal");
    expect(subjectVisualTheme("science").motif).toBe("science-orbit");
    expect(subjectVisualTheme("social studies").motif).toBe("civic-compass");
  });
});
