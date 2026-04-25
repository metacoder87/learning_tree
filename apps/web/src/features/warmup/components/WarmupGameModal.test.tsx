import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WarmupGameModal } from "./WarmupGameModal";


const leaf = {
  id: 1,
  title: "Counting On",
  subtopicKey: "counting-on",
  gradeTitle: "Grade 1",
  subjectTitle: "Math",
  x: 0,
  y: 0,
  radius: 28,
  hitRadius: 56,
  masteryLevel: 0,
  previewText: "Count forward.",
};


afterEach(() => {
  cleanup();
});


describe("WarmupGameModal", () => {
  it("renders a waiting warmup while the first token is pending", async () => {
    const onSpeakText = vi.fn();
    render(<WarmupGameModal isOpen leaf={leaf} onSpeakText={onSpeakText} />);

    expect(screen.getByRole("dialog", { name: /lesson warmup game/i })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "1" }));
    expect(onSpeakText).toHaveBeenCalled();
  });

  it("shows completion when the fidget goal is reached", async () => {
    render(<WarmupGameModal isOpen leaf={leaf} onSpeakText={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: "1" }));
    await userEvent.click(screen.getByRole("button", { name: "2" }));
    await userEvent.click(screen.getByRole("button", { name: "3" }));

    expect(screen.getByText(/fidget complete/i)).toBeTruthy();
  });

  it("does not render when closed", () => {
    render(<WarmupGameModal isOpen={false} leaf={leaf} onSpeakText={vi.fn()} />);
    expect(screen.queryByRole("dialog", { name: /lesson warmup game/i })).toBeNull();
  });
});
