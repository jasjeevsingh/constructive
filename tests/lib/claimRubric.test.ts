import { describe, it, expect } from "vitest";
import { getClaimRubric, renderRubric, CLAIM_TURN_CAP } from "@/lib/claimRubric";
import { ClaimRubricSchema } from "@/lib/schemas";

describe("claim rubric", () => {
  it("has exactly the four agreed criteria, in order", () => {
    expect(getClaimRubric().criteria.map((c) => c.id)).toEqual([
      "one-idea",
      "takes-a-side",
      "concrete",
      "contestable",
    ]);
  });

  it("gives every criterion a contrasting bad/good example pair", () => {
    for (const c of getClaimRubric().criteria) {
      expect(c.bad.length).toBeGreaterThan(0);
      expect(c.good.length).toBeGreaterThan(0);
      expect(c.bad).not.toBe(c.good);
    }
  });

  it("renders every criterion name and both examples into the prompt block", () => {
    const text = renderRubric();
    for (const c of getClaimRubric().criteria) {
      expect(text).toContain(c.name);
      expect(text).toContain(c.bad);
      expect(text).toContain(c.good);
    }
  });

  it("caps the coaching loop at three turns", () => {
    expect(CLAIM_TURN_CAP).toBe(3);
  });

  it("rejects a rubric with no criteria", () => {
    expect(() => ClaimRubricSchema.parse({ version: 1, intro: "x", criteria: [] })).toThrow();
  });

  it("rejects a criterion with a blank field", () => {
    expect(() =>
      ClaimRubricSchema.parse({
        version: 1,
        intro: "x",
        criteria: [{ id: "one-idea", name: "One idea", test: "", bad: "b", good: "g" }],
      })
    ).toThrow();
  });

  it("includes the exemplar claim in the rendered prompt block", () => {
    const rubric = getClaimRubric();
    expect(rubric.exemplar).toBeTruthy();
    expect(renderRubric()).toContain(rubric.exemplar as string);
  });

  it("still parses a rubric that omits the optional exemplar", () => {
    const criteria = [{ id: "one-idea", name: "One idea", test: "t", bad: "b", good: "g" }];
    expect(() => ClaimRubricSchema.parse({ version: 1, intro: "x", criteria })).not.toThrow();
  });
});
