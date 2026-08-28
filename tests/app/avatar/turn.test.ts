import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/ai/claude", () => ({
  getChatClient: () => ({
    complete: vi.fn(async () => "Homework reinforces learning through repetition."),
  }),
}));

import { POST } from "@/app/api/avatar/turn/route";

describe("POST /api/avatar/turn", () => {
  it("returns avatar response text", async () => {
    const body = {
      mode: "sparring",
      phase: "debate",
      motion: "This House would ban homework",
      cohort: "darshan",
      avatarSide: "against",
      studentSide: "for",
      transcript: [],
    };
    const res = await POST(new Request("http://localhost/api/avatar/turn", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.text).toBe("Homework reinforces learning through repetition.");
  });

  it("returns 400 for invalid body", async () => {
    const res = await POST(new Request("http://localhost/api/avatar/turn", {
      method: "POST",
      body: "not json",
    }));
    expect(res.status).toBe(400);
  });
});
