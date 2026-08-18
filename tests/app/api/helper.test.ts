import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const complete = vi.fn();
vi.mock("@/lib/ai/claude", () => ({ getChatClient: () => ({ complete }) }));

const { POST } = await import("@/app/api/helper/route");

function req(body: unknown) {
  return new Request("http://localhost/api/helper", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
const ctx = { activity: "journey", motion: "This House would ban homework.", side: "for", stage: "claim", claimDraft: null, transcript: [] };

beforeEach(() => {
  complete.mockReset();
  complete.mockResolvedValue("What happens because of that?");
  process.env.ANTHROPIC_API_KEY = "k";
});
afterEach(() => { delete process.env.ANTHROPIC_API_KEY; });

describe("POST /api/helper", () => {
  it("replies to the newest message", async () => {
    const res = await POST(req({ messages: [{ role: "student", text: "phones are bad" }], context: ctx }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ reply: "What happens because of that?" });
  });

  it("sends the page context in the system prompt", async () => {
    await POST(req({ messages: [{ role: "student", text: "hi" }], context: ctx }));
    expect(complete.mock.calls[0][0].system).toContain("This House would ban homework.");
  });

  it("passes earlier turns as history, newest as user", async () => {
    await POST(req({ messages: [
      { role: "student", text: "first" },
      { role: "helper", text: "why?" },
      { role: "student", text: "second" },
    ], context: ctx }));
    const args = complete.mock.calls[0][0];
    expect(args.user).toBe("second");
    expect(args.history).toEqual([
      { role: "user", content: "first" },
      { role: "assistant", content: "why?" },
    ]);
  });

  it("400s when the newest message is not from the student", async () => {
    const res = await POST(req({ messages: [{ role: "helper", text: "hi" }], context: ctx }));
    expect(res.status).toBe(400);
  });

  it("400s on an empty message, too many turns, and an over-long turn", async () => {
    expect((await POST(req({ messages: [{ role: "student", text: "  " }], context: ctx }))).status).toBe(400);
    const many = Array.from({ length: 41 }, () => ({ role: "student" as const, text: "x" }));
    expect((await POST(req({ messages: many, context: ctx }))).status).toBe(400);
    expect((await POST(req({ messages: [{ role: "student", text: "x".repeat(2001) }], context: ctx }))).status).toBe(400);
  });

  it("503s when no AI key is configured", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    complete.mockRejectedValue(new Error("no key"));
    const res = await POST(req({ messages: [{ role: "student", text: "hi" }], context: ctx }));
    expect(res.status).toBe(503);
  });

  it("never leaks an internal error message", async () => {
    complete.mockRejectedValue(new Error("ANTHROPIC_API_KEY=sk-secret"));
    const res = await POST(req({ messages: [{ role: "student", text: "hi" }], context: ctx }));
    expect(await res.text()).not.toContain("sk-secret");
  });
});
