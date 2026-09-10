import { describe, it, expect } from "vitest";
import { orderChoices, strongChoice, verdictLabel } from "@/lib/choices";
import { getFlowMotions } from "@/lib/flowMotions";
import { choicePrompt } from "@/lib/prompts/choice";
import { FlowSideSchema, FlowClaimSchema } from "@/lib/schemas";

describe("choices", () => {
  it("finds the single strong option", () => {
    expect(strongChoice([{ verdict: "too-broad" }, { verdict: "strong", id: 1 }])).toEqual({ verdict: "strong", id: 1 });
    expect(() => strongChoice([{ verdict: "too-broad" }])).toThrow();
  });

  it("labels verdicts per part and falls back to the raw verdict", () => {
    expect(verdictLabel("claim", "too-broad")).toBe("Too broad");
    expect(verdictLabel("impact", "no-scale")).toBe("No sense of scale");
    expect(verdictLabel("claim", "mystery")).toBe("mystery");
  });

  it("rotates deterministically by seed and keeps every option", () => {
    const a = orderChoices([1, 2, 3, 4], "seed-a");
    expect(orderChoices([1, 2, 3, 4], "seed-a")).toEqual(a);
    expect([...a].sort()).toEqual([1, 2, 3, 4]);
    expect(orderChoices([1, 2, 3, 4], "b")).not.toEqual(orderChoices([1, 2, 3, 4], "c"));
  });
});

describe("choice schemas", () => {
  const claim = {
    id: "c1", claim: "x", impact: "y",
    candidates: [
      { id: "e", text: "e", material: "evidence", verdict: "fits", explanation: "e" },
      { id: "r", text: "r", material: "reasoning", verdict: "fits", explanation: "r" },
    ],
  };
  it("accepts a side without choices (generated motions)", () => {
    expect(FlowSideSchema.safeParse({ claims: [claim] }).success).toBe(true);
  });
  it("requires exactly one strong claim choice that names an authored claim", () => {
    const ok = {
      claims: [claim],
      claimChoices: [
        { id: "a", text: "a", verdict: "strong", explanation: "a", claimId: "c1" },
        { id: "b", text: "b", verdict: "too-broad", explanation: "b" },
      ],
    };
    expect(FlowSideSchema.safeParse(ok).success).toBe(true);
    const noStrong = { ...ok, claimChoices: ok.claimChoices.map((c) => ({ ...c, verdict: "too-broad" })) };
    expect(FlowSideSchema.safeParse(noStrong).success).toBe(false);
    const badId = { ...ok, claimChoices: [{ ...ok.claimChoices[0], claimId: "nope" }, ok.claimChoices[1]] };
    expect(FlowSideSchema.safeParse(badId).success).toBe(false);
  });
  it("requires exactly one strong impact choice", () => {
    const one = { ...claim, impactChoices: [
      { id: "a", text: "y", verdict: "strong", explanation: "a" },
      { id: "b", text: "b", verdict: "no-scale", explanation: "b" },
    ] };
    expect(FlowClaimSchema.safeParse(one).success).toBe(true);
    const two = { ...claim, impactChoices: one.impactChoices.map((c) => ({ ...c, verdict: "strong" })) };
    expect(FlowClaimSchema.safeParse(two).success).toBe(false);
  });
});

describe("seeded bank choice sets", () => {
  it("gives every side four claim choices and the strong claim four impact choices", () => {
    for (const m of getFlowMotions()) {
      for (const side of ["for", "against"] as const) {
        const s = m.sides[side];
        expect(s.claimChoices, `${m.id}/${side}`).toHaveLength(4);
        const strong = strongChoice(s.claimChoices!);
        const claim = s.claims.find((c) => c.id === strong.claimId)!;
        expect(claim, `${m.id}/${side} strong claimId`).toBeDefined();
        expect(strong.text).toBe(claim.claim);
        expect(claim.impactChoices, `${m.id}/${claim.id}`).toHaveLength(4);
        expect(strongChoice(claim.impactChoices!).text).toBe(claim.impact);
        // Every verdict type appears once, so each wrong pick teaches a different lesson.
        expect(new Set(s.claimChoices!.map((c) => c.verdict)).size).toBe(4);
        expect(new Set(claim.impactChoices!.map((c) => c.verdict)).size).toBe(4);
      }
    }
  });
});

describe("choicePrompt", () => {
  it("hands the coach the pick, the verdict, and the note, and forbids revealing the best option", () => {
    const p = choicePrompt({
      motion: "THW ban homework.", side: "for", part: "claim", claim: null,
      chosen: "Homework is bad.", verdictLabel: "Too broad", explanation: "A feeling.", best: "Banning homework gives kids time to rest.",
    });
    expect(p.user).toContain("Homework is bad.");
    expect(p.user).toContain("Too broad");
    expect(p.user).toContain("A feeling.");
    expect(p.system.toLowerCase()).toContain("do not quote or reveal");
    expect(p.system).toContain('"kind":"choice"');
  });
  it("includes the claim for an impact pick", () => {
    const p = choicePrompt({
      motion: "m", side: "against", part: "impact", claim: "Practice makes skills stick.",
      chosen: "x", verdictLabel: "No sense of scale", explanation: "e", best: "b",
    });
    expect(p.user).toContain("Practice makes skills stick.");
    expect(p.system).toContain("so what");
  });
});
