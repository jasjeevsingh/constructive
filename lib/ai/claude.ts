import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

export interface ChatClient {
  complete(args: { system: string; user: string }): Promise<string>;
}

const ANTHROPIC_MODEL = process.env.COACH_MODEL ?? "claude-sonnet-5";
const OPENAI_MODEL = process.env.OPENAI_COACH_MODEL ?? "gpt-4o-mini";

export function createAnthropicClient(apiKey: string): ChatClient {
  const anthropic = new Anthropic({ apiKey });
  return {
    async complete({ system, user }) {
      const msg = await anthropic.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: 1024,
        system,
        messages: [{ role: "user", content: user }],
      });
      return msg.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
    },
  };
}

export function createOpenAIClient(apiKey: string): ChatClient {
  const openai = new OpenAI({ apiKey });
  return {
    async complete({ system, user }) {
      const msg = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        max_tokens: 1024,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
      });
      const text = msg.choices[0]?.message?.content;
      if (!text) throw new Error("OpenAI returned empty content");
      return text;
    },
  };
}

/** Anthropic first; on failure (or missing key), use OpenAI if configured. */
export function createFallbackClient(
  primary: ChatClient | null,
  fallback: ChatClient | null
): ChatClient {
  if (!primary && !fallback) {
    throw new Error("No AI API key configured (ANTHROPIC_API_KEY or OPENAI_API_KEY)");
  }
  return {
    async complete(args) {
      if (primary) {
        try {
          return await primary.complete(args);
        } catch (err) {
          if (!fallback) throw err;
        }
      }
      return fallback!.complete(args);
    },
  };
}

export function getChatClient(): ChatClient {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  return createFallbackClient(
    anthropicKey ? createAnthropicClient(anthropicKey) : null,
    openaiKey ? createOpenAIClient(openaiKey) : null
  );
}
