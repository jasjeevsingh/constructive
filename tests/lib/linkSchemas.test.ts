import { describe, it, expect } from "vitest";
import { LinkScenarioSchema, LinkScenariosFileSchema } from "@/lib/schemas";

const good = {
  id: "ls-x",
  claim: "This House would ban homework.",
  impact: "Kids get more time for family.",
  candidates: [
    { id: "c1", text: "Frees evenings for family.", material: "reasoning", verdict: "fits", explanation: "Bridges directly." },
    { id: "c2", text: "Studies tie homework to stress.", material: "evidence", verdict: "fits", explanation: "Evidence for wellbeing." },
  ],
};

describe("LinkScenarioSchema", () => {
  it("accepts a well-formed scenario", () => {
    expect(LinkScenarioSchema.parse(good)).toEqual(good);
  });
  it("rejects an unknown verdict", () => {
    const bad = { ...good, candidates: [{ ...good.candidates[0], verdict: "maybe" }] };
    expect(() => LinkScenarioSchema.parse(bad)).toThrow();
  });
  it("rejects an unknown material", () => {
    const bad = { ...good, candidates: [{ ...good.candidates[0], material: "vibes" }] };
    expect(() => LinkScenarioSchema.parse(bad)).toThrow();
  });
  it("validates an array file", () => {
    expect(() => LinkScenariosFileSchema.parse([good])).not.toThrow();
  });
});
