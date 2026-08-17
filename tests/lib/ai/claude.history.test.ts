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

const { createAnthropicClient, createOpenAIClient } = await import("@/lib/ai/claude");

beforeEach(() => {
  anthropicCreate.mockClear();
  openaiCreate.mockClear();
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
