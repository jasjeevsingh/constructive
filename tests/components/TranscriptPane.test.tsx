import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TranscriptPane } from "@/components/avatar/TranscriptPane";
import type { AvatarTurn, InlineScore } from "@/lib/avatar/types";

const TRANSCRIPT: AvatarTurn[] = [
  { speaker: "student", text: "Homework should be banned.", timestampMs: 0, durationMs: 5000 },
  { speaker: "avatar", text: "But practice is important.", timestampMs: 5000, durationMs: 4000 },
];

describe("TranscriptPane", () => {
  it("renders each turn with speaker label", () => {
    render(<TranscriptPane transcript={TRANSCRIPT} inlineScores={[]} />);
    expect(screen.getByText("You")).toBeInTheDocument();
    expect(screen.getByText("Avatar")).toBeInTheDocument();
    expect(screen.getByText("Homework should be banned.")).toBeInTheDocument();
    expect(screen.getByText("But practice is important.")).toBeInTheDocument();
  });

  it("renders inline score badges", () => {
    const scores: InlineScore[] = [
      { criterion: "Link", score: 2, rationale: "Solid connection.", turnIndex: 0 },
    ];
    render(<TranscriptPane transcript={TRANSCRIPT} inlineScores={scores} />);
    expect(screen.getByText(/Link.*2/)).toBeInTheDocument();
  });

  it("renders empty state when no transcript", () => {
    render(<TranscriptPane transcript={[]} inlineScores={[]} />);
    expect(screen.getByText(/start speaking/i)).toBeInTheDocument();
  });
});
