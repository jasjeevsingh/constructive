import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/ai/claude", () => ({ getGenerateClient: () => ({ async complete() { return ""; } }) }));
const generateMotions = vi.fn();
const generateScaffold = vi.fn();
vi.mock("@/lib/ai/generate", () => ({
  generateMotions: (...a: unknown[]) => generateMotions(...a),
  generateScaffold: (...a: unknown[]) => generateScaffold(...a),
}));

import { POST as motionsPOST } from "@/app/api/generate/motions/route";
import { POST as scaffoldPOST } from "@/app/api/generate/scaffold/route";

function req(body: unknown): Request {
  return new Request("http://test", { method: "POST", body: JSON.stringify(body) });
}
const solvable = {
  claim: "c", impact: "i", candidates: [
    { text: "t", material: "evidence", verdict: "fits", explanation: "e" },
    { text: "t2", material: "reasoning", verdict: "fits", explanation: "e" },
    { text: "t3", material: "evidence", verdict: "great-but-wrong", explanation: "e" },
  ],
};

beforeEach(() => { generateMotions.mockReset(); generateScaffold.mockReset(); });

describe("/api/generate/motions", () => {
  it("400s on invalid body", async () => {
    expect((await motionsPOST(req({}))).status).toBe(400);
  });
  it("returns generated motions", async () => {
    generateMotions.mockResolvedValue({ refused: false, motions: [{ motion: "M", keywords: [], hook: "H" }] });
    const res = await motionsPOST(req({ universe: "Naruto" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ refused: false });
  });
  it("500s when generation throws", async () => {
    generateMotions.mockRejectedValue(new Error("boom"));
    expect((await motionsPOST(req({ universe: "Naruto" }))).status).toBe(500);
  });
});

describe("/api/generate/scaffold", () => {
  it("returns solvability-enforced sides", async () => {
    generateScaffold.mockResolvedValue({ refused: false, sides: { for: { claims: [solvable] }, against: { claims: [solvable] } } });
    const res = await scaffoldPOST(req({ universe: "Naruto", motion: "M" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ refused: false });
  });
  it("422s when no side is solvable", async () => {
    const bad = { claim: "c", impact: "i", candidates: [{ text: "t", material: "evidence", verdict: "fits", explanation: "e" }] };
    generateScaffold.mockResolvedValue({ refused: false, sides: { for: { claims: [bad] }, against: { claims: [bad] } } });
    expect((await scaffoldPOST(req({ universe: "Naruto", motion: "M" }))).status).toBe(422);
  });
});
