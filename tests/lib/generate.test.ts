import { describe, it, expect } from "vitest";
import { generateMotions, generateScaffold } from "@/lib/ai/generate";
import type { ChatClient } from "@/lib/ai/claude";

function stub(outputs: string[]): ChatClient {
  let i = 0;
  return { async complete() { return outputs[Math.min(i++, outputs.length - 1)]; } };
}

const motionsJson = JSON.stringify({
  motions: [{ motion: "M", keywords: [{ word: "w", hint: null }], hook: "H" }],
});
const scaffoldJson = JSON.stringify({
  sides: {
    for: { claims: [{ claim: "c", impact: "i", candidates: [
      { text: "t", material: "evidence", verdict: "fits", explanation: "e" },
      { text: "t2", material: "reasoning", verdict: "fits", explanation: "e" },
    ] }] },
    against: { claims: [{ claim: "c", impact: "i", candidates: [
      { text: "t", material: "evidence", verdict: "fits", explanation: "e" },
      { text: "t2", material: "reasoning", verdict: "fits", explanation: "e" },
    ] }] },
  },
});

describe("generateMotions", () => {
  it("returns validated motions on a clean response", async () => {
    const r = await generateMotions("Naruto", stub([motionsJson]));
    expect(r).toEqual({ refused: false, motions: [{ motion: "M", keywords: [{ word: "w", hint: null }], hook: "H" }] });
  });
  it("parses the refusal branch", async () => {
    const r = await generateMotions("gore fest", stub([JSON.stringify({ refused: true, reason: "let's pick something school-friendly" })]));
    expect(r).toEqual({ refused: true, reason: "let's pick something school-friendly" });
  });
  it("repairs a bad first response, then succeeds", async () => {
    const r = await generateMotions("Naruto", stub(["not json at all", motionsJson]));
    expect(r).toMatchObject({ refused: false });
  });
  it("throws when still invalid after repair", async () => {
    await expect(generateMotions("Naruto", stub(["nope", "still nope"]))).rejects.toThrow();
  });
});

describe("generateScaffold", () => {
  it("returns validated sides", async () => {
    const r = await generateScaffold("Naruto", "M", stub([scaffoldJson]));
    expect(r).toMatchObject({ refused: false });
  });
  it("tolerates code-fenced JSON", async () => {
    const r = await generateScaffold("Naruto", "M", stub(["```json\n" + scaffoldJson + "\n```"]));
    expect(r).toMatchObject({ refused: false });
  });
});
