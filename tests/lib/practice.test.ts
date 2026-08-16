import { describe, it, expect } from "vitest";
import { drawItem } from "@/lib/practice";
import type { FlowMotion } from "@/lib/schemas";

const motions: FlowMotion[] = [
  {
    id: "m1",
    motion: "Motion one.",
    keywords: [],
    sides: {
      for: {
        claims: [
          {
            id: "c1",
            claim: "Claim one.",
            impact: "Impact one.",
            candidates: [
              { id: "e1", text: "ev", material: "evidence", verdict: "fits", explanation: "e" },
              { id: "r1", text: "re", material: "reasoning", verdict: "fits", explanation: "e" },
            ],
          },
        ],
      },
      against: { claims: [] },
    },
  },
];

describe("drawItem", () => {
  it("draws a claim item with the side's authored claims", () => {
    const item = drawItem("claim", motions, () => 0);
    expect(item).toEqual({
      part: "claim",
      motion: "Motion one.",
      side: "for",
      claims: [{ id: "c1", claim: "Claim one." }],
    });
  });

  it("draws a link item with a practice-namespaced scenario id", () => {
    const item = drawItem("link", motions, () => 0);
    if (item.part !== "link") throw new Error("wrong part");
    expect(item.scenario.id).toBe("practice:m1:c1");
    expect(item.scenario.candidates).toHaveLength(2);
  });

  it("draws an impact item with the claim + authored impact", () => {
    const item = drawItem("impact", motions, () => 0);
    expect(item).toEqual({
      part: "impact",
      motion: "Motion one.",
      claim: "Claim one.",
      authoredImpact: "Impact one.",
    });
  });

  it("throws when no motion has any claims", () => {
    const empty: FlowMotion[] = [
      { id: "x", motion: "m", keywords: [], sides: { for: { claims: [] }, against: { claims: [] } } },
    ];
    expect(() => drawItem("claim", empty, () => 0)).toThrow();
  });
});
