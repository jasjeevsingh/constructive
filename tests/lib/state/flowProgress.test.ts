import { describe, it, expect, beforeEach } from "vitest";
import {
  emptyFlowProgress, loadFlowProgress, saveFlowProgress, FLOW_STORAGE_KEY,
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
});
