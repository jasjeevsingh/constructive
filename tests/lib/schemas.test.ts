import { describe, it, expect } from "vitest";
import { MotionSchema, MotionsFileSchema, CoachResponseSchema } from "@/lib/schemas";

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
});
