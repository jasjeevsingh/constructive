import { describe, it, expect, vi, beforeEach } from "vitest";

const anthropicCreate = vi.fn(async (_args: any) => ({
  content: [{ type: "text", text: "{}" }],
}));
const openaiCreate = vi.fn(async (_args: any) => ({
  choices: [{ message: { content: "{}" } }],
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: anthropicCreate };
  },
}));
vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create: openaiCreate } };
  },
}));

const { createAnthropicClient, createOpenAIClient, getChatClient } = await import("@/lib/ai/claude");

beforeEach(() => {
  anthropicCreate.mockClear();
  openaiCreate.mockClear();
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.OPENAI_API_KEY;
});

describe("ChatClient history", () => {
  it("sends a single user message when no history is given (anthropic)", async () => {
    await createAnthropicClient("k").complete({ system: "s", user: "u" });
    expect(anthropicCreate.mock.calls[0][0].messages).toEqual([{ role: "user", content: "u" }]);
  });

  it("places prior turns before the final user message, in order (anthropic)", async () => {
    await createAnthropicClient("k").complete({
      system: "s",
      user: "u2",
      history: [
        { role: "user", content: "u1" },
        { role: "assistant", content: "a1" },
      ],
    });
    expect(anthropicCreate.mock.calls[0][0].messages).toEqual([
      { role: "user", content: "u1" },
      { role: "assistant", content: "a1" },
      { role: "user", content: "u2" },
    ]);
  });

  it("places prior turns after system and before the final user message (openai)", async () => {
    await createOpenAIClient("k").complete({
      system: "s",
      user: "u2",
      history: [{ role: "user", content: "u1" }],
    });
    expect(openaiCreate.mock.calls[0][0].messages).toEqual([
      { role: "system", content: "s" },
      { role: "user", content: "u1" },
      { role: "user", content: "u2" },
    ]);
  });
});

// F3: response_format must be opt-in, defaulting to the current JSON
// behaviour so /api/coach and the generate routes (which always ask
// createOpenAIClient for its default) are unaffected.
describe("createOpenAIClient — response_format opt-in (F3)", () => {
  it("defaults to json_object, unchanged from before", async () => {
    await createOpenAIClient("k").complete({ system: "s", user: "u" });
    expect(openaiCreate.mock.calls[0][0].response_format).toEqual({ type: "json_object" });
  });

  it("still defaults to json_object when json is explicitly true", async () => {
    await createOpenAIClient("k", { json: true }).complete({ system: "s", user: "u" });
    expect(openaiCreate.mock.calls[0][0].response_format).toEqual({ type: "json_object" });
  });

  it("omits response_format when json is false, for a prose prompt like the helper's", async () => {
    await createOpenAIClient("k", { json: false }).complete({ system: "s", user: "u" });
    expect(openaiCreate.mock.calls[0][0].response_format).toBeUndefined();
  });
});

describe("getChatClient — passes json through to the OpenAI fallback (F3)", () => {
  it("requests json_object by default (the /api/coach and generate routes' path)", async () => {
    process.env.OPENAI_API_KEY = "k";
    await getChatClient().complete({ system: "s", user: "u" });
    expect(openaiCreate.mock.calls[0][0].response_format).toEqual({ type: "json_object" });
  });

  it("requests prose when told json: false (the helper route's path)", async () => {
    process.env.OPENAI_API_KEY = "k";
    await getChatClient({ json: false }).complete({ system: "s", user: "u" });
    expect(openaiCreate.mock.calls[0][0].response_format).toBeUndefined();
  });
});
