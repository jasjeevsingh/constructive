import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TranscriptDrawer } from "@/components/avatar/TranscriptPane";
import type { AvatarTurn, InlineScore } from "@/lib/avatar/types";

const TRANSCRIPT: AvatarTurn[] = [
  { speaker: "student", text: "Homework should be banned.", timestampMs: 0, durationMs: 5000 },
  { speaker: "avatar", text: "But practice is important.", timestampMs: 5000, durationMs: 4000 },
];

describe("TranscriptDrawer", () => {
  it("renders each turn with speaker label when open", () => {
    render(<TranscriptDrawer transcript={TRANSCRIPT} inlineScores={[]} open onClose={() => {}} />);
    expect(screen.getByText("You")).toBeInTheDocument();
    expect(screen.getByText("Avatar")).toBeInTheDocument();
    expect(screen.getByText("Homework should be banned.")).toBeInTheDocument();
    expect(screen.getByText("But practice is important.")).toBeInTheDocument();
  });

  it("renders inline score badges", () => {
    const scores: InlineScore[] = [
      { criterion: "Link", score: 2, rationale: "Solid connection.", turnIndex: 0 },
    ];
    render(<TranscriptDrawer transcript={TRANSCRIPT} inlineScores={scores} open onClose={() => {}} />);
    expect(screen.getByText(/Link.*2/)).toBeInTheDocument();
  });

  it("renders empty state when no transcript", () => {
    render(<TranscriptDrawer transcript={[]} inlineScores={[]} open onClose={() => {}} />);
    expect(screen.getByText(/no turns yet/i)).toBeInTheDocument();
  });
});
