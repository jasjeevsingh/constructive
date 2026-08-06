import Anthropic from "@anthropic-ai/sdk";

export interface ChatClient {
  complete(args: { system: string; user: string }): Promise<string>;
}

const MODEL = process.env.COACH_MODEL ?? "claude-sonnet-5";

export function getChatClient(): ChatClient {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  const anthropic = new Anthropic({ apiKey });
  return {
    async complete({ system, user }) {
      const msg = await anthropic.messages.create({
        model: MODEL,
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
