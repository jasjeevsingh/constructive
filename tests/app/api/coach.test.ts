import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Claude client factory so the route never hits the network.
vi.mock("@/lib/ai/claude", () => ({
  getChatClient: () => ({
    complete: async () =>
      JSON.stringify({ kind: "restate", reaction: "Good start", capturedCore: true }),
  }),
}));

import { POST } from "@/app/api/coach/route";

function post(body: unknown): Request {
  return new Request("http://test/api/coach", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/coach", () => {
  it("returns a coach response for a valid request", async () => {
    const res = await POST(post({ step: "restate", motion: "THW ban homework.", payload: { restate: "no homework" } }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ kind: "restate", capturedCore: true });
  });

  it("returns 400 for an invalid request", async () => {
    const res = await POST(post({ step: "bogus", motion: "" }));
    expect(res.status).toBe(400);
  });
});
