import { describe, it, expect } from "vitest";
import { getFlowMotions, getFlowMotion, flowMotionToMotion, claimToScenario } from "@/lib/flowMotions";

describe("flow motions bank", () => {
  it("loads and validates the bank", () => {
    expect(getFlowMotions().length).toBeGreaterThanOrEqual(2);
  });
  it("finds a motion by id", () => {
    expect(getFlowMotion("m-kids-vote")?.motion).toContain("let kids vote");
  });
  it("every motion has exactly 3 claims on BOTH sides", () => {
    for (const m of getFlowMotions()) {
      expect(m.sides.for.claims.length).toBe(3);
      expect(m.sides.against.claims.length).toBe(3);
    }
  });
  it("every claim on both sides is winnable and has a great-but-wrong trap", () => {
    for (const m of getFlowMotions()) {
      for (const side of ["for", "against"] as const) {
        for (const c of m.sides[side].claims) {
          const fits = c.candidates.filter((x) => x.verdict === "fits");
          expect(fits.some((x) => x.material === "evidence")).toBe(true);
          expect(fits.some((x) => x.material === "reasoning")).toBe(true);
          expect(c.candidates.some((x) => x.verdict === "great-but-wrong")).toBe(true);
        }
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
    const s = claimToScenario("m-kids-vote", c);
    expect(s).toEqual({ id: `m-kids-vote:${c.id}`, claim: c.claim, impact: c.impact, candidates: c.candidates });
  });
});
