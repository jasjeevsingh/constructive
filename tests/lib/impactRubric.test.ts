import { describe, it, expect } from "vitest";
import { getImpactRubric, renderImpactRubric } from "@/lib/impactRubric";
import { ClaimRubricSchema } from "@/lib/schemas";

describe("impact rubric", () => {
  it("has exactly the three agreed criteria, in order", () => {
    expect(getImpactRubric().criteria.map((c) => c.id)).toEqual([
      "magnitude",
      "probability",
      "timeframe",
    ]);
  });

  it("gives every criterion a contrasting bad/good example pair", () => {
    for (const c of getImpactRubric().criteria) {
      expect(c.bad.length).toBeGreaterThan(0);
      expect(c.good.length).toBeGreaterThan(0);
      expect(c.bad).not.toBe(c.good);
    }
  });

  it("renders every criterion name and both examples into the prompt block", () => {
    const text = renderImpactRubric();
    for (const c of getImpactRubric().criteria) {
      expect(text).toContain(c.name);
      expect(text).toContain(c.bad);
      expect(text).toContain(c.good);
    }
  });

  it("includes the comparative framing in the intro", () => {
    const text = renderImpactRubric();
    expect(text).toContain("comparison");
  });

  it("validates against the same schema as the claim rubric", () => {
    const rubric = getImpactRubric();
    expect(() => ClaimRubricSchema.parse(rubric)).not.toThrow();
  });
});
