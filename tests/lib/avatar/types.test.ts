import { describe, it, expect } from "vitest";
import { InlineScoreSchema, RoundScoreSchema } from "@/lib/avatar/types";

describe("InlineScoreSchema", () => {
  it("accepts a valid inline score", () => {
    const result = InlineScoreSchema.safeParse({
      criterion: "Link",
      score: 2,
      rationale: "Evidence present but reasoning gap remains.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects score outside 0-3", () => {
    const result = InlineScoreSchema.safeParse({
      criterion: "Link",
      score: 4,
      rationale: "Too high.",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing criterion", () => {
    const result = InlineScoreSchema.safeParse({
      score: 2,
      rationale: "Missing field.",
    });
    expect(result.success).toBe(false);
  });
});

describe("RoundScoreSchema", () => {
  it("accepts a valid round score", () => {
    const result = RoundScoreSchema.safeParse({
      argumentation: { claim: 2, link: 1, impact: 3, weighing: 1 },
      engagement: { breadth: 2, depth: 2, responsive: 3, crystallizing: 1 },
      rationales: {
        claim: "Clear and specific.",
        link: "Evidence missing.",
        impact: "Strong real-world connection.",
        weighing: "No comparison made.",
        breadth: "Two angles covered.",
        depth: "Developed one point well.",
        responsive: "Directly addressed opponent.",
        crystallizing: "No synthesis attempted.",
      },
      focusArea: "weighing",
      focusTip: "Try painting a picture of what the world looks like if your side wins.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects when a sub-criterion score exceeds 3", () => {
    const result = RoundScoreSchema.safeParse({
      argumentation: { claim: 5, link: 1, impact: 3, weighing: 1 },
      engagement: { breadth: 2, depth: 2, responsive: 3, crystallizing: 1 },
      rationales: {},
      focusArea: "claim",
      focusTip: "Tip.",
    });
    expect(result.success).toBe(false);
  });
});
