import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/ai/deepgram", () => ({
  transcribeAudio: async (buf: Buffer) =>
    buf.length > 0 ? "kids should be able to vote" : "",
}));

import { POST } from "@/app/api/transcribe/route";

function post(bytes: Uint8Array): Request {
  return new Request("http://test/api/transcribe", {
    method: "POST",
    headers: { "content-type": "audio/webm" },
    body: Buffer.from(bytes),
  });
}

describe("POST /api/transcribe", () => {
  it("returns transcribed text for audio", async () => {
    const res = await POST(post(new Uint8Array([1, 2, 3, 4])));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ text: "kids should be able to vote" });
  });

  it("returns 400 for an empty body", async () => {
    const res = await POST(post(new Uint8Array([])));
    expect(res.status).toBe(400);
  });

  it("returns 400 for audio over the size cap", async () => {
    const res = await POST(post(new Uint8Array(10 * 1024 * 1024 + 1)));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "audio too large" });
  });
});
