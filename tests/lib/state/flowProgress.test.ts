import { describe, it, expect, beforeEach } from "vitest";
import {
  emptyFlowProgress, loadFlowProgress, saveFlowProgress, loadAllFlowProgress,
  hasFlowProgress, hasAdvancedAnywhere, clearFlowProgressForPrefix, FLOW_STORAGE_KEY,
} from "@/lib/state/flowProgress";

describe("flowProgress store", () => {
  beforeEach(() => localStorage.clear());

  it("returns empty progress when nothing stored (defaults to FOR/claim)", () => {
    const p = loadFlowProgress(localStorage, "m1");
    expect(p).toEqual(emptyFlowProgress());
    expect(p.side).toBe("for");
    expect(p.stage).toBe("claim");
  });
  it("round-trips under the versioned key", () => {
    saveFlowProgress(localStorage, "m1", { ...emptyFlowProgress(), stage: "link", mappedClaimId: "c-stake" });
    const p = loadFlowProgress(localStorage, "m1");
    expect(p.stage).toBe("link");
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
  it("drops an entry with an unknown stage", () => {
    localStorage.setItem(
      FLOW_STORAGE_KEY,
      JSON.stringify({ m1: { ...emptyFlowProgress(), stage: "refute" } })
    );
    expect(loadFlowProgress(localStorage, "m1")).toEqual(emptyFlowProgress());
  });

  describe("legacy entries from before the Read stage was retired", () => {
    const legacy = {
      side: "against", stage: "read", readSubstep: "keyword", restate: "kids should vote",
      keywordAnswers: { kids: "under 18" }, mappedClaimId: null, impact: "",
      forComplete: false, againstComplete: false,
    };
    it("loads a 'read' entry on the Claim stage, keeping side and keyword answers", () => {
      localStorage.setItem(FLOW_STORAGE_KEY, JSON.stringify({ m1: legacy }));
      const p = loadFlowProgress(localStorage, "m1");
      expect(p.stage).toBe("claim");
      expect(p.side).toBe("against");
      expect(p.keywordAnswers).toEqual({ kids: "under 18" });
    });
    it("strips the retired fields so they never round-trip", () => {
      localStorage.setItem(FLOW_STORAGE_KEY, JSON.stringify({ m1: legacy }));
      const p = loadFlowProgress(localStorage, "m1");
      expect(p).not.toHaveProperty("restate");
      expect(p).not.toHaveProperty("readSubstep");
      saveFlowProgress(localStorage, "m1", p);
      expect(localStorage.getItem(FLOW_STORAGE_KEY)).not.toContain("restate");
    });
    it("keeps a legacy entry that had already moved past Read on its real stage", () => {
      localStorage.setItem(
        FLOW_STORAGE_KEY,
        JSON.stringify({ m1: { ...legacy, stage: "link", mappedClaimId: "c1" } })
      );
      expect(loadFlowProgress(localStorage, "m1").stage).toBe("link");
    });
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
  it("reports whether the student has advanced past Claim anywhere", () => {
    expect(hasAdvancedAnywhere(localStorage)).toBe(false);
    saveFlowProgress(localStorage, "m1", emptyFlowProgress());
    expect(hasAdvancedAnywhere(localStorage)).toBe(false);
    saveFlowProgress(localStorage, "m2", { ...emptyFlowProgress(), stage: "link" });
    expect(hasAdvancedAnywhere(localStorage)).toBe(true);
  });
  it("counts a finished side as having advanced even if the cursor is back on Claim", () => {
    saveFlowProgress(localStorage, "m1", { ...emptyFlowProgress("against"), forComplete: true });
    expect(hasAdvancedAnywhere(localStorage)).toBe(true);
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
