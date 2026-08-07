import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/ai/deepgram", () => ({
  speakText: async (text: string) => ({
    audio: Buffer.from(`audio:${text}`),
    contentType: "audio/mpeg",
  }),
}));

import { POST } from "@/app/api/speak/route";

function post(body: unknown): Request {
  return new Request("http://test/api/speak", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/speak", () => {
  it("returns Aura audio for coach text", async () => {
    const res = await POST(post({ text: "Nice restatement." }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("audio/mpeg");
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.toString()).toBe("audio:Nice restatement.");
  });

  it("returns 400 for empty text", async () => {
    const res = await POST(post({ text: "  " }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for text over the length cap", async () => {
    const res = await POST(post({ text: "a".repeat(4001) }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "text too long" });
  });
});
