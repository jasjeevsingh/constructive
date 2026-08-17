import { describe, it, expect, beforeEach } from "vitest";
import {
  emptyFlowProgress, loadFlowProgress, saveFlowProgress, loadAllFlowProgress,
  hasFlowProgress, clearFlowProgressForPrefix, FLOW_STORAGE_KEY,
} from "@/lib/state/flowProgress";

describe("flowProgress store", () => {
  beforeEach(() => localStorage.clear());

  it("returns empty progress when nothing stored (defaults to FOR/read/restate)", () => {
    const p = loadFlowProgress(localStorage, "m1");
    expect(p).toEqual(emptyFlowProgress());
    expect(p.side).toBe("for");
    expect(p.stage).toBe("read");
    expect(p.readSubstep).toBe("restate");
  });
  it("round-trips under the versioned key", () => {
    saveFlowProgress(localStorage, "m1", { ...emptyFlowProgress(), stage: "claim", mappedClaimId: "c-stake" });
    const p = loadFlowProgress(localStorage, "m1");
    expect(p.stage).toBe("claim");
    expect(p.mappedClaimId).toBe("c-stake");
    expect(localStorage.getItem(FLOW_STORAGE_KEY)).toContain("m1");
  });
  it("keeps motions independent", () => {
    saveFlowProgress(localStorage, "m1", { ...emptyFlowProgress(), forComplete: true });
    saveFlowProgress(localStorage, "m2", { ...emptyFlowProgress(), stage: "link" });
    expect(loadFlowProgress(localStorage, "m1").forComplete).toBe(true);
    expect(loadFlowProgress(localStorage, "m2").stage).toBe("link");
  });
  it("falls back to empty on corrupt storage", () => {
    localStorage.setItem(FLOW_STORAGE_KEY, "{nope");
    expect(loadFlowProgress(localStorage, "m1")).toEqual(emptyFlowProgress());
  });
  it("drops a malformed entry (missing fields) and returns empty for it", () => {
    localStorage.setItem(FLOW_STORAGE_KEY, JSON.stringify({ m1: { stage: "claim" } }));
    expect(loadFlowProgress(localStorage, "m1")).toEqual(emptyFlowProgress());
  });
  it("starts on the requested side", () => {
    expect(emptyFlowProgress("against").side).toBe("against");
    expect(emptyFlowProgress().side).toBe("for");
  });
  it("reports whether a motion has saved progress", () => {
    expect(hasFlowProgress(localStorage, "m1")).toBe(false);
    saveFlowProgress(localStorage, "m1", emptyFlowProgress("against"));
    expect(hasFlowProgress(localStorage, "m1")).toBe(true);
  });
  it("loads a fresh entry on the requested side", () => {
    expect(loadFlowProgress(localStorage, "m1", "against").side).toBe("against");
  });
  it("clears only the entries matching a prefix", () => {
    saveFlowProgress(localStorage, "gen:naruto:0", emptyFlowProgress());
    saveFlowProgress(localStorage, "gen:naruto:1", emptyFlowProgress());
    saveFlowProgress(localStorage, "gen:potter:0", emptyFlowProgress());
    saveFlowProgress(localStorage, "m1", emptyFlowProgress());
    clearFlowProgressForPrefix(localStorage, "gen:naruto:");
    const all = loadAllFlowProgress(localStorage);
    expect(Object.keys(all).sort()).toEqual(["gen:potter:0", "m1"]);
  });
});
