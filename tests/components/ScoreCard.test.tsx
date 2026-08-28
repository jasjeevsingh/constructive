import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScoreCard } from "@/components/avatar/ScoreCard";
import type { RoundScore } from "@/lib/avatar/types";

const SAMPLE_SCORE: RoundScore = {
  round: 1,
  argumentation: { claim: 2, link: 1, impact: 3, weighing: 0 },
  engagement: { breadth: 2, depth: 2, responsive: 3, crystallizing: 1 },
  rationales: {
    claim: "Clear.", link: "Weak.", impact: "Strong.", weighing: "Missing.",
    breadth: "Good range.", depth: "OK.", responsive: "Engaged.", crystallizing: "Absent.",
  },
  focusArea: "weighing",
  focusTip: "Paint a picture of what the world looks like if your side wins.",
};

describe("ScoreCard", () => {
  it("renders the rubric grid with scores", () => {
    render(<ScoreCard mode="sparring" roundScores={[SAMPLE_SCORE]} onContinue={() => {}} onEnd={() => {}} />);
    expect(screen.getByText("Claim")).toBeInTheDocument();
    expect(screen.getByText("Link")).toBeInTheDocument();
    expect(screen.getByText("Impact")).toBeInTheDocument();
    expect(screen.getByText("Weighing")).toBeInTheDocument();
  });

  it("highlights the focus area", () => {
    render(<ScoreCard mode="sparring" roundScores={[SAMPLE_SCORE]} onContinue={() => {}} onEnd={() => {}} />);
    expect(screen.getByText(/weighing/i)).toBeInTheDocument();
    expect(screen.getByText(/paint a picture/i)).toBeInTheDocument();
  });

  it("shows Continue button when there are more rounds", async () => {
    const onContinue = vi.fn();
    render(<ScoreCard mode="sparring" roundScores={[SAMPLE_SCORE]} onContinue={onContinue} onEnd={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /next round/i }));
    expect(onContinue).toHaveBeenCalled();
  });

  it("shows End button", async () => {
    const onEnd = vi.fn();
    render(<ScoreCard mode="sparring" roundScores={[SAMPLE_SCORE]} onContinue={() => {}} onEnd={onEnd} />);
    await userEvent.click(screen.getByRole("button", { name: /end session/i }));
    expect(onEnd).toHaveBeenCalled();
  });
});
