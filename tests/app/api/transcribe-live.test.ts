import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/ai/deepgramLiveSession", () => ({
  startLiveSession: vi.fn(async () => "session-1"),
  sendLiveAudio: vi.fn(async () => ({ text: "live partial" })),
  finishLiveSession: vi.fn(async () => ({ text: "live final transcript" })),
}));

import { POST } from "@/app/api/transcribe/live/route";
import { startLiveSession, sendLiveAudio, finishLiveSession } from "@/lib/ai/deepgramLiveSession";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.DEEPGRAM_API_KEY = "test-key";
});

describe("POST /api/transcribe/live", () => {
  it("starts a live session", async () => {
    const req = new Request("http://test/api/transcribe/live?action=start", { method: "POST" });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sessionId: "session-1" });
    expect(startLiveSession).toHaveBeenCalled();
  });

  it("forwards audio chunks", async () => {
    const req = new Request("http://test/api/transcribe/live?sessionId=session-1", {
      method: "POST",
      body: Buffer.from([1, 2, 3]),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ text: "live partial" });
    expect(sendLiveAudio).toHaveBeenCalledWith("session-1", expect.any(Buffer));
  });

  it("returns 400 for audio chunks over the size cap", async () => {
    const req = new Request("http://test/api/transcribe/live?sessionId=session-1", {
      method: "POST",
      body: Buffer.from(new Uint8Array(2 * 1024 * 1024 + 1)),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "audio chunk too large" });
    expect(sendLiveAudio).not.toHaveBeenCalled();
  });

  it("finishes a live session", async () => {
    const req = new Request("http://test/api/transcribe/live?action=stop&sessionId=session-1", {
      method: "POST",
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ text: "live final transcript" });
    expect(finishLiveSession).toHaveBeenCalledWith("session-1");
  });
});
