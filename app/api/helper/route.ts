import { z } from "zod";
import { getChatClient } from "@/lib/ai/claude";
import { helperPrompt } from "@/lib/helper/helperPrompt";
import { MAX_HELPER_TURNS, MAX_HELPER_TURN_LENGTH } from "@/lib/helper/limits";
import type { HelperContext } from "@/lib/helper/context";

const TurnSchema = z.object({
  role: z.enum(["student", "helper"]),
  text: z.string().trim().min(1).max(MAX_HELPER_TURN_LENGTH),
});

const BodySchema = z.object({
  messages: z.array(TurnSchema).min(1).max(MAX_HELPER_TURNS),
  context: z.record(z.string(), z.unknown()),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "invalid request" }, { status: 400 });

  const messages = parsed.data.messages;
  const latest = messages[messages.length - 1];
  // The newest turn must be the student's — otherwise there is nothing to answer.
  if (latest.role !== "student") return Response.json({ error: "invalid request" }, { status: 400 });

  const prior = messages.slice(0, -1);
  const system = helperPrompt(parsed.data.context as unknown as HelperContext, "text");
  const history = prior.map((t) => ({
    role: t.role === "student" ? ("user" as const) : ("assistant" as const),
    content: t.text,
  }));

  try {
    // Prose, not JSON: the helper's prompt is conversational and never
    // mentions "json", so OpenAI's json_object mode (the fallback client's
    // default) rejects it outright — opt out so an Anthropic outage doesn't
    // take the whole chat down, and so a student never sees a raw JSON blob.
    const reply = await getChatClient({ json: false }).complete({ system, user: latest.text, history });
    return Response.json({ reply: reply.trim() });
  } catch {
    // Static string: an upstream error can carry key material.
    return Response.json({ error: "helper unavailable" }, { status: 503 });
  }
}
