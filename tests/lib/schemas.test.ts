import { describe, it, expect } from "vitest";
import { MotionSchema, MotionsFileSchema, CoachResponseSchema, CoachRequestSchema } from "@/lib/schemas";

describe("MotionSchema", () => {
  it("accepts a well-formed motion", () => {
    const ok = {
      id: "m1",
      motion: "This House would let kids vote.",
      keywords: [{ word: "kids", hint: "Scope is the fight." }, { word: "vote", hint: null }],
      theme: "general",
    };
    expect(MotionSchema.parse(ok)).toEqual(ok);
  });

  it("rejects a motion missing keywords", () => {
    const bad = { id: "m1", motion: "x", theme: "general" };
    expect(() => MotionSchema.parse(bad)).toThrow();
  });

  it("validates an array of motions", () => {
    expect(() => MotionsFileSchema.parse([])).not.toThrow();
  });
});

describe("CoachResponseSchema", () => {
  it("accepts a refine response", () => {
    const r = {
      kind: "refine",
      verdicts: [{ argumentId: "for-0", verdict: "distinct", question: null }],
      duplicateGroups: [["for-0", "for-1"]],
    };
    expect(CoachResponseSchema.parse(r)).toEqual(r);
  });

  it("rejects an unknown kind", () => {
    expect(() => CoachResponseSchema.parse({ kind: "nope" })).toThrow();
  });

  it("accepts a mid-loop claim response with a null mapped id", () => {
    const parsed = CoachResponseSchema.parse({
      kind: "claim",
      reaction: "Nice start.",
      verdict: "keep-going",
      question: "Which one of those is the real problem?",
      mappedClaimId: null,
    });
    expect(parsed.kind).toBe("claim");
  });

  it("rejects a claim response missing the verdict", () => {
    expect(() =>
      CoachResponseSchema.parse({ kind: "claim", reaction: "x", question: null, mappedClaimId: null })
    ).toThrow();
  });

  it("accepts a request carrying prior turns", () => {
    const parsed = CoachRequestSchema.parse({
      step: "claim",
      motion: "m",
      payload: {},
      history: [{ role: "student", text: "hi" }],
    });
    expect(parsed.history?.[0].role).toBe("student");
  });

  it("rejects a request whose history is over the length cap", () => {
    const history = Array.from({ length: 11 }, () => ({ role: "student" as const, text: "hi" }));
    expect(() =>
      CoachRequestSchema.parse({ step: "claim", motion: "m", payload: {}, history })
    ).toThrow();
  });

  it("rejects a turn whose text is over the character cap", () => {
    expect(() => CoachRequestSchema.parse({
      step: "claim",
      motion: "m",
      payload: {},
      history: [{ role: "student", text: "x".repeat(2001) }],
    })).toThrow();
  });
});
