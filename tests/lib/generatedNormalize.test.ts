import { describe, it, expect } from "vitest";
import {
  slug,
  motionCardId,
  claimIsSolvable,
  enforceSolvableSides,
  assembleFlowMotion,
  ScaffoldError,
} from "@/lib/generatedNormalize";
import type { GeneratedSides } from "@/lib/schemas";

const solvableClaim = {
  claim: "Kids deserve a say.",
  impact: "A fairer future.",
  candidates: [
    { text: "Turnout data", material: "evidence", verdict: "fits", explanation: "supports it" },
    { text: "Represents them", material: "reasoning", verdict: "fits", explanation: "connects" },
    { text: "A shiny distractor", material: "evidence", verdict: "great-but-wrong", explanation: "argues the other way" },
  ],
} as const;

function sides(forClaims: unknown[], againstClaims: unknown[]): GeneratedSides {
  return { for: { claims: forClaims as any }, against: { claims: againstClaims as any } };
}

describe("slug", () => {
  it("lowercases, hyphenates, and strips junk", () => {
    expect(slug("Harry Potter!")).toBe("harry-potter");
    expect(slug("  Jujutsu   Kaisen  ")).toBe("jujutsu-kaisen");
  });
  it("falls back to 'universe' when empty", () => {
    expect(slug("!!!")).toBe("universe");
  });
});

describe("motionCardId", () => {
  it("namespaces by slug and index", () => {
    expect(motionCardId("Naruto", 2)).toBe("gen:naruto:2");
  });
});

describe("claimIsSolvable", () => {
  it("requires fitting evidence + fitting reasoning + a distractor", () => {
    expect(claimIsSolvable(solvableClaim.candidates)).toBe(true);
    expect(claimIsSolvable([
      { material: "evidence", verdict: "fits" },
      { material: "reasoning", verdict: "fits" },
    ])).toBe(false); // no distractor
    expect(claimIsSolvable([
      { material: "evidence", verdict: "fits" },
      { material: "evidence", verdict: "doesnt-fit" },
    ])).toBe(false); // no fitting reasoning
  });
});

describe("enforceSolvableSides", () => {
  it("drops unsolvable claims but keeps solvable ones", () => {
    const bad = { claim: "x", impact: "y", candidates: [{ text: "t", material: "evidence", verdict: "fits", explanation: "e" }] };
    const clean = enforceSolvableSides(sides([solvableClaim, bad], [solvableClaim]));
    expect(clean.for.claims).toHaveLength(1);
    expect(clean.against.claims).toHaveLength(1);
  });
  it("throws ScaffoldError when a side has no solvable claim", () => {
    const bad = { claim: "x", impact: "y", candidates: [{ text: "t", material: "evidence", verdict: "fits", explanation: "e" }] };
    expect(() => enforceSolvableSides(sides([solvableClaim], [bad]))).toThrow(ScaffoldError);
  });
});

describe("assembleFlowMotion", () => {
  it("assigns deterministic ids and produces a valid FlowMotion", () => {
    const motion = assembleFlowMotion(
      "gen:naruto:0",
      "This house believes the Hidden Villages do more harm than good.",
      [{ word: "Hidden Villages", hint: null }],
      sides([solvableClaim], [solvableClaim])
    );
    expect(motion.id).toBe("gen:naruto:0");
    expect(motion.sides.for.claims[0].id).toBe("c1");
    const cand = motion.sides.for.claims[0].candidates;
    expect(cand.map((c) => c.id)).toEqual(["e1", "r1", "e2"]);
  });
});
