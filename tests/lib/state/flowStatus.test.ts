import { describe, it, expect, beforeEach } from "vitest";
import {
  motionStatus,
  loadAllFlowProgress,
  saveFlowProgress,
  emptyFlowProgress,
} from "@/lib/state/flowProgress";

describe("motionStatus", () => {
  it("is not-started for an absent entry", () => {
    expect(motionStatus(undefined)).toBe("not-started");
  });
  it("is complete when both sides are done", () => {
    expect(motionStatus({ ...emptyFlowProgress(), forComplete: true, againstComplete: true })).toBe("complete");
  });
  it("reports one-side-done regardless of which side was finished", () => {
    expect(motionStatus({ ...emptyFlowProgress(), forComplete: true })).toBe("one-side-done");
    expect(motionStatus({ ...emptyFlowProgress("against"), againstComplete: true })).toBe(
      "one-side-done"
    );
  });
  it("is in-progress for a started-but-unfinished entry", () => {
    expect(motionStatus({ ...emptyFlowProgress(), stage: "claim" })).toBe("in-progress");
  });
});

describe("loadAllFlowProgress", () => {
  beforeEach(() => localStorage.clear());
  it("returns every saved motion's progress", () => {
    saveFlowProgress(localStorage, "m1", { ...emptyFlowProgress(), forComplete: true });
    saveFlowProgress(localStorage, "m2", { ...emptyFlowProgress(), stage: "link" });
    const all = loadAllFlowProgress(localStorage);
    expect(Object.keys(all).sort()).toEqual(["m1", "m2"]);
    expect(all.m1.forComplete).toBe(true);
  });
  it("tolerates corrupt storage", () => {
    localStorage.setItem("constructive:flow:v1", "{nope");
    expect(loadAllFlowProgress(localStorage)).toEqual({});
  });
});
