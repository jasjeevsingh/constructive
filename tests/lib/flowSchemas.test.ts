import { describe, it, expect } from "vitest";
import { FlowMotionSchema, FlowMotionsFileSchema } from "@/lib/schemas";

const claim = (id: string) => ({
  id,
  claim: "Kids deserve a say in decisions that affect their future.",
  impact: "Government invests more in young people's long-term future.",
  candidates: [
    { id: "c1", text: "Frees future voters to shape policy.", material: "reasoning", verdict: "fits", explanation: "Bridges claim to impact." },
    { id: "c2", text: "Turnout studies tie early voting to lifelong engagement.", material: "evidence", verdict: "fits", explanation: "Evidence for the impact." },
    { id: "c3", text: "A Nobel economist studied voting systems.", material: "evidence", verdict: "great-but-wrong", explanation: "Impressive but irrelevant." },
  ],
});
const good = {
  id: "m-x",
  motion: "This House would let kids vote.",
  keywords: [{ word: "kids", hint: null }],
  sides: { for: { claims: [claim("a"), claim("b"), claim("c")] }, against: { claims: [] } },
};

describe("FlowMotionSchema", () => {
  it("accepts a well-formed flow motion", () => {
    expect(FlowMotionSchema.parse(good)).toEqual(good);
  });
  it("rejects a claim with an unknown verdict", () => {
    const bad = JSON.parse(JSON.stringify(good));
    bad.sides.for.claims[0].candidates[0].verdict = "nope";
    expect(() => FlowMotionSchema.parse(bad)).toThrow();
  });
  it("validates an array file", () => {
    expect(() => FlowMotionsFileSchema.parse([good])).not.toThrow();
  });
});
