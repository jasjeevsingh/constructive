import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

export interface ChatClient {
  complete(args: { system: string; user: string }): Promise<string>;
}

const ANTHROPIC_MODEL = process.env.COACH_MODEL ?? "claude-sonnet-5";
const OPENAI_MODEL = process.env.OPENAI_COACH_MODEL ?? "gpt-4o-mini";
const GENERATE_MODEL = process.env.GENERATE_MODEL ?? "claude-sonnet-5";
const OPENAI_GENERATE_MODEL = process.env.OPENAI_GENERATE_MODEL ?? "gpt-4o";

export function createAnthropicClient(
  apiKey: string,
  opts?: { model?: string; maxTokens?: number }
): ChatClient {
  const anthropic = new Anthropic({ apiKey });
  const model = opts?.model ?? ANTHROPIC_MODEL;
  const maxTokens = opts?.maxTokens ?? 1024;
  return {
    async complete({ system, user }) {
      const msg = await anthropic.messages.create({
        model,
        max_tokens: maxTokens,
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

export function createOpenAIClient(
  apiKey: string,
  opts?: { model?: string; maxTokens?: number }
): ChatClient {
  const openai = new OpenAI({ apiKey });
  const model = opts?.model ?? OPENAI_MODEL;
  const maxTokens = opts?.maxTokens ?? 1024;
  return {
    async complete({ system, user }) {
      const msg = await openai.chat.completions.create({
        model,
        max_tokens: maxTokens,
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

/** A stronger, higher-budget client for content generation (universe motions). */
export function getGenerateClient(): ChatClient {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  return createFallbackClient(
    anthropicKey ? createAnthropicClient(anthropicKey, { model: GENERATE_MODEL, maxTokens: 8000 }) : null,
    openaiKey ? createOpenAIClient(openaiKey, { model: OPENAI_GENERATE_MODEL, maxTokens: 8000 }) : null
  );
}
