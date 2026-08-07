import { describe, it, expect } from "vitest";
import { getFlowMotions, getFlowMotion, flowMotionToMotion, claimToScenario } from "@/lib/flowMotions";

describe("flow motions bank", () => {
  it("loads and validates the bank", () => {
    expect(getFlowMotions().length).toBeGreaterThanOrEqual(2);
  });
  it("finds a motion by id", () => {
    expect(getFlowMotion("m-kids-vote")?.motion).toContain("let kids vote");
  });
  it("every authored FOR side has exactly 3 claims", () => {
    for (const m of getFlowMotions()) {
      if (m.sides.for.claims.length > 0) expect(m.sides.for.claims.length).toBe(3);
    }
  });
  it("every claim's bank is winnable and has a great-but-wrong trap", () => {
    for (const m of getFlowMotions()) {
      for (const c of m.sides.for.claims) {
        const fits = c.candidates.filter((x) => x.verdict === "fits");
        expect(fits.some((x) => x.material === "evidence")).toBe(true);
        expect(fits.some((x) => x.material === "reasoning")).toBe(true);
        expect(c.candidates.some((x) => x.verdict === "great-but-wrong")).toBe(true);
      }
    }
  });
  it("adapts a flow motion to a Motion (for KeywordStep)", () => {
    const m = getFlowMotion("m-kids-vote")!;
    const motion = flowMotionToMotion(m);
    expect(motion).toEqual({ id: m.id, motion: m.motion, keywords: m.keywords, theme: "general" });
  });
  it("adapts a claim to a LinkScenario (for LinkCard)", () => {
    const c = getFlowMotion("m-kids-vote")!.sides.for.claims[0];
    const s = claimToScenario(c);
    expect(s).toEqual({ id: c.id, claim: c.claim, impact: c.impact, candidates: c.candidates });
  });
});
