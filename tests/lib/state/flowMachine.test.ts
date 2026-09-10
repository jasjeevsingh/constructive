import { describe, it, expect } from "vitest";
import {
  STAGES, SIDES, STAGE_LABELS, nextStage, prevStage, stageIndex, isLastStage, isFlowStage, otherSideUnlocked,
} from "@/lib/state/flowMachine";

describe("flowMachine", () => {
  it("declares the three stages and the sides in order", () => {
    expect(STAGES).toEqual(["claim", "link", "impact"]);
    expect(SIDES).toEqual(["for", "against"]);
    expect(Object.keys(STAGE_LABELS)).toEqual(STAGES);
  });
  it("advances and clamps at the end", () => {
    expect(nextStage("claim")).toBe("link");
    expect(nextStage("impact")).toBe("impact");
  });
  it("goes back and clamps at the start", () => {
    expect(prevStage("link")).toBe("claim");
    expect(prevStage("claim")).toBe("claim");
  });
  it("reports index and last-stage", () => {
    expect(stageIndex("link")).toBe(1);
    expect(isLastStage("impact")).toBe(true);
    expect(isLastStage("claim")).toBe(false);
  });
  it("recognises only live stage names", () => {
    expect(isFlowStage("claim")).toBe(true);
    expect(isFlowStage("read")).toBe(false);
    expect(isFlowStage(3)).toBe(false);
  });
  it("unlocks the other side once either side is complete", () => {
    expect(otherSideUnlocked({ forComplete: false, againstComplete: false })).toBe(false);
    expect(otherSideUnlocked({ forComplete: true, againstComplete: false })).toBe(true);
    expect(otherSideUnlocked({ forComplete: false, againstComplete: true })).toBe(true);
  });
});
