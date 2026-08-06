import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MotionCard } from "@/components/MotionCard";
import { getMotion } from "@/lib/motions";

beforeEach(() => localStorage.clear());

describe("MotionCard", () => {
  it("pins the motion text and starts on the restate step", () => {
    const motion = getMotion("m-kids-vote")!;
    render(<MotionCard motion={motion} onExit={() => {}} />);
    // Motion appears pinned in the header.
    expect(screen.getAllByText(/let kids vote/i).length).toBeGreaterThanOrEqual(1);
    // Restate step's prompt is visible first.
    expect(screen.getByText(/your own words/i)).toBeInTheDocument();
  });
});
