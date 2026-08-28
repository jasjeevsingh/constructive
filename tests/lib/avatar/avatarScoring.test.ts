import { describe, it, expect, vi } from "vitest";
import { scoreRound, scoreInline, pickFocusArea } from "@/lib/avatar/avatarScoring";
import type { ChatClient } from "@/lib/ai/claude";
import type { AvatarScoreRequest, AvatarTurn, RoundScore } from "@/lib/avatar/types";

function mockClient(response: string): ChatClient {
  return { complete: vi.fn(async () => response) };
}

const SAMPLE_TRANSCRIPT: AvatarTurn[] = [
  { speaker: "student", text: "Homework should be banned because it causes stress.", timestampMs: 0, durationMs: 5000 },
  { speaker: "avatar", text: "But doesn't practice reinforce learning?", timestampMs: 5000, durationMs: 4000 },
  { speaker: "student", text: "Studies show diminishing returns after 30 minutes.", timestampMs: 9000, durationMs: 6000 },
];

const VALID_ROUND_RESPONSE = JSON.stringify({
  argumentation: { claim: 2, link: 1, impact: 2, weighing: 1 },
  engagement: { breadth: 2, depth: 2, responsive: 3, crystallizing: 1 },
  rationales: {
    claim: "Clear position stated.",
    link: "Evidence mentioned but not connected.",
    impact: "Some real-world relevance.",
    weighing: "No comparison attempted.",
    breadth: "Two angles covered.",
    depth: "One point developed.",
    responsive: "Directly addressed the challenge.",
    crystallizing: "No synthesis.",
  },
  focusArea: "weighing",
  focusTip: "Paint a picture of what happens if your side wins vs. loses.",
});

const VALID_INLINE_RESPONSE = JSON.stringify({
  criterion: "Link",
  score: 1,
  rationale: "Evidence mentioned but reasoning gap remains.",
});

describe("scoreRound", () => {
  it("returns a validated RoundScore from the AI response", async () => {
    const client = mockClient(VALID_ROUND_RESPONSE);
    const req: AvatarScoreRequest = {
      mode: "sparring",
      transcript: SAMPLE_TRANSCRIPT,
      criteria: ["argumentation", "engagement"],
      cohort: "darshan",
    };
    const result = await scoreRound(req, client);
    expect(result.argumentation.claim).toBe(2);
    expect(result.focusArea).toBe("weighing");
    expect(client.complete).toHaveBeenCalledOnce();
  });

  it("throws on invalid AI response", async () => {
    const client = mockClient('{"bad": "data"}');
    const req: AvatarScoreRequest = {
      mode: "sparring",
      transcript: SAMPLE_TRANSCRIPT,
      criteria: ["argumentation", "engagement"],
      cohort: "darshan",
    };
    await expect(scoreRound(req, client)).rejects.toThrow();
  });
});

describe("scoreInline", () => {
  it("returns a validated InlineScore", async () => {
    const client = mockClient(VALID_INLINE_RESPONSE);
    const req: AvatarScoreRequest = {
      mode: "pushback",
      transcript: SAMPLE_TRANSCRIPT.slice(0, 2),
      criteria: ["argumentation"],
      cohort: "darshan",
    };
    const result = await scoreInline(req, client);
    expect(result.criterion).toBe("Link");
    expect(result.score).toBe(1);
  });
});

describe("pickFocusArea", () => {
  it("picks the sub-criterion with the lowest score", () => {
    const score: Omit<RoundScore, "round" | "focusArea" | "focusTip"> = {
      argumentation: { claim: 3, link: 2, impact: 3, weighing: 0 },
      engagement: { breadth: 2, depth: 2, responsive: 3, crystallizing: 1 },
      rationales: {},
    };
    const { focusArea } = pickFocusArea(score as RoundScore);
    expect(focusArea).toBe("weighing");
  });
});
