import { describe, it, expect, vi } from "vitest";

const speakTextStream = vi.fn(async (text: string) => ({
  stream: new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(`audio:${text}`));
      controller.close();
    },
  }),
  contentType: "audio/mpeg",
}));

vi.mock("@/lib/ai/deepgram", () => ({ speakTextStream: (text: string) => speakTextStream(text) }));

import { POST } from "@/app/api/speak/route";

function post(body: unknown): Request {
  return new Request("http://test/api/speak", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/speak", () => {
  it("streams Aura audio for coach text", async () => {
    const res = await POST(post({ text: "Nice restatement." }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("audio/mpeg");
    expect(res.headers.get("cache-control")).toBe("no-store");
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.toString()).toBe("audio:Nice restatement.");
    expect(speakTextStream).toHaveBeenCalledWith("Nice restatement.");
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

  it("returns 500 when speech synthesis fails", async () => {
    speakTextStream.mockRejectedValueOnce(new Error("deepgram down"));
    const res = await POST(post({ text: "hello" }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "speech failed" });
  });
});
