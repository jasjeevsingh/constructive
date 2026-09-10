import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CliCheatSheet, CHEATSHEET_STORAGE_KEY, cheatSheetDefaultOpen } from "@/components/CliCheatSheet";
import { emptyFlowProgress, saveFlowProgress } from "@/lib/state/flowProgress";

beforeEach(() => localStorage.clear());

describe("cheatSheetDefaultOpen", () => {
  it("is open for a brand-new student", () => {
    expect(cheatSheetDefaultOpen(localStorage)).toBe(true);
  });
  it("closes once the student has advanced past Claim somewhere", () => {
    saveFlowProgress(localStorage, "m1", { ...emptyFlowProgress(), stage: "link" });
    expect(cheatSheetDefaultOpen(localStorage)).toBe(false);
  });
  it("lets an explicit choice win over the progress heuristic", () => {
    saveFlowProgress(localStorage, "m1", { ...emptyFlowProgress(), stage: "link" });
    localStorage.setItem(CHEATSHEET_STORAGE_KEY, "open");
    expect(cheatSheetDefaultOpen(localStorage)).toBe(true);
    localStorage.setItem(CHEATSHEET_STORAGE_KEY, "closed");
    expect(cheatSheetDefaultOpen(localStorage)).toBe(false);
  });
});

describe("CliCheatSheet", () => {
  it("shows the three definitions with the current stage highlighted", () => {
    render(<CliCheatSheet stage="link" />);
    expect(screen.getByText(/main point you want the audience to believe/i)).toBeInTheDocument();
    expect(screen.getByText(/step-by-step logic/i)).toBeInTheDocument();
    expect(screen.getByText(/why your argument actually matters/i)).toBeInTheDocument();
    expect(screen.getByTestId("cheatsheet-current")).toHaveTextContent(/^Link/);
  });

  it("collapses and remembers the choice", async () => {
    render(<CliCheatSheet stage="claim" />);
    const toggle = screen.getByRole("button", { name: /quick reference/i });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(/step-by-step logic/i)).toBeNull();
    expect(localStorage.getItem(CHEATSHEET_STORAGE_KEY)).toBe("closed");
  });

  it("starts collapsed for a student who has already advanced", async () => {
    saveFlowProgress(localStorage, "m1", { ...emptyFlowProgress(), stage: "impact" });
    render(<CliCheatSheet stage="claim" />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /quick reference/i })).toHaveAttribute("aria-expanded", "false")
    );
  });
});
