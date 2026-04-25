import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProfileSelector } from "./ProfileSelector";


afterEach(() => {
  cleanup();
});


describe("ProfileSelector", () => {
  it("chooses an existing profile", async () => {
    const onChooseProfile = vi.fn();

    render(
      <ProfileSelector
        error={null}
        isLoading={false}
        profiles={[{ id: 7, display_name: "Ada", age_band: "elementary" }]}
        selectedProfileId={7}
        onChooseProfile={onChooseProfile}
        onCreateProfile={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /Ada/i }));
    expect(onChooseProfile).toHaveBeenCalledWith(7);
  });

  it("creates a profile from a typed name", async () => {
    const onCreateProfile = vi.fn().mockResolvedValue(undefined);

    render(
      <ProfileSelector
        error={null}
        isLoading={false}
        profiles={[]}
        selectedProfileId={null}
        onChooseProfile={vi.fn()}
        onCreateProfile={onCreateProfile}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /add a child profile/i }));
    await userEvent.type(screen.getByLabelText(/child profile name/i), "Grace");
    await userEvent.click(screen.getByRole("button", { name: /create profile/i }));

    expect(onCreateProfile).toHaveBeenCalledWith("Grace", "elementary");
  });
});
