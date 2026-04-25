import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RewardGameModal, capRewardScore } from "./RewardGameModal";


const VOCABULARY = ["apple", "moon", "sun", "tree", "book", "story"];


function renderRewardGame({
  gradeTitle = "Grade 1",
  sessionKey = 1,
  subject = "Reading",
  onSpeakText = vi.fn(),
}: {
  gradeTitle?: string;
  sessionKey?: number;
  subject?: string;
  onSpeakText?: (text: string) => void;
} = {}) {
  return render(
    <RewardGameModal
      gradeTitle={gradeTitle}
      isOpen
      onClose={vi.fn()}
      onSpeakText={onSpeakText}
      sessionKey={sessionKey}
      subject={subject}
      vocabularyWords={VOCABULARY}
    />,
  );
}


function currentBubbleTarget() {
  const target = document.querySelector(".bubble-pop-game .warmup-instruction strong")?.textContent;
  if (!target) {
    throw new Error("Bubble target was not rendered.");
  }
  return target;
}


async function clickCurrentBubble() {
  await userEvent.click(screen.getByRole("button", { name: currentBubbleTarget() }));
}


afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});


describe("RewardGameModal", () => {
  it("completes Bubble Pop without cross-component update warnings", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    renderRewardGame();

    for (let index = 0; index < 5; index += 1) {
      await clickCurrentBubble();
    }

    expect(await screen.findByText("Reward complete")).toBeTruthy();
    const warningCalls = consoleError.mock.calls.filter((call) =>
      String(call[0]).includes("Cannot update a component"),
    );
    expect(warningCalls).toHaveLength(0);
  });

  it("does not count the same popped bubble twice", async () => {
    renderRewardGame();

    const firstTarget = currentBubbleTarget();
    const firstBubble = screen.getByRole("button", { name: firstTarget });
    await userEvent.click(firstBubble);

    await waitFor(() => expect(screen.getByText("Round 1/5")).toBeTruthy());
    await userEvent.click(firstBubble);

    expect(screen.getByText("Round 1/5")).toBeTruthy();
  });

  it("replay resets Bubble Pop completion and score", async () => {
    renderRewardGame();

    for (let index = 0; index < 5; index += 1) {
      await clickCurrentBubble();
    }

    expect(await screen.findByText("Reward complete")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /replay round/i }));

    await waitFor(() => expect(screen.getByText("Round 0/5")).toBeTruthy());
    expect(screen.queryByText("Reward complete")).toBeNull();
  });

  it("completes Pattern Caterpillar after the required rounds", async () => {
    renderRewardGame({
      gradeTitle: "Grade 1",
      sessionKey: 2,
      subject: "Reading",
    });

    await userEvent.click(screen.getByRole("button", { name: "Blue leaf" }));
    await userEvent.click(screen.getByRole("button", { name: "Drop here" }));
    await screen.findByText("Finish the shape pattern.");

    await userEvent.click(screen.getByRole("button", { name: "Circle spot" }));
    await userEvent.click(screen.getByRole("button", { name: "Drop here" }));

    expect(await screen.findByText("Reward complete")).toBeTruthy();
  });

  it("caps dewdrop-style scores at the reward goal", () => {
    expect(capRewardScore(8, 5)).toBe(5);
    expect(capRewardScore(-2, 5)).toBe(0);
    expect(capRewardScore(3, 5)).toBe(3);
  });
});
