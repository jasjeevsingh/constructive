import { describe, it, expect, vi } from "vitest";

const ROUND_RESPONSE = JSON.stringify({
  argumentation: { claim: 2, link: 1, impact: 2, weighing: 1 },
  engagement: { breadth: 2, depth: 2, responsive: 3, crystallizing: 1 },
  rationales: { claim: "ok", link: "ok", impact: "ok", weighing: "ok", breadth: "ok", depth: "ok", responsive: "ok", crystallizing: "ok" },
  focusArea: "weighing",
  focusTip: "Compare worlds.",
});

vi.mock("@/lib/ai/claude", () => ({
  getChatClient: () => ({
    complete: vi.fn(async () => ROUND_RESPONSE),
  }),
}));

import { POST } from "@/app/api/avatar/score/route";

describe("POST /api/avatar/score", () => {
  it("returns a round score", async () => {
    const body = {
      scoreType: "round",
      mode: "sparring",
      transcript: [
        { speaker: "student", text: "Ban homework.", timestampMs: 0, durationMs: 3000 },
      ],
      criteria: ["argumentation", "engagement"],
      cohort: "darshan",
    };
    const res = await POST(new Request("http://localhost/api/avatar/score", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.argumentation.claim).toBe(2);
    expect(data.focusArea).toBe("weighing");
  });
});
