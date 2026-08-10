import { describe, it, expect } from "vitest";
import {
  STAGES, READ_SUBSTEPS, SIDES, nextStage, prevStage, stageIndex, isLastStage, againstUnlocked,
} from "@/lib/state/flowMachine";

describe("flowMachine", () => {
  it("declares stages, read substeps, and sides in order", () => {
    expect(STAGES).toEqual(["read", "claim", "link", "impact"]);
    expect(READ_SUBSTEPS).toEqual(["restate", "keyword"]);
    expect(SIDES).toEqual(["for", "against"]);
  });
  it("advances and clamps at the end", () => {
    expect(nextStage("read")).toBe("claim");
    expect(nextStage("impact")).toBe("impact");
  });
  it("goes back and clamps at the start", () => {
    expect(prevStage("claim")).toBe("read");
    expect(prevStage("read")).toBe("read");
  });
  it("reports index and last-stage", () => {
    expect(stageIndex("link")).toBe(2);
    expect(isLastStage("impact")).toBe(true);
    expect(isLastStage("read")).toBe(false);
  });
  it("unlocks AGAINST only once FOR is complete", () => {
    expect(againstUnlocked(false)).toBe(false);
    expect(againstUnlocked(true)).toBe(true);
  });
});
