import type { ChatClient } from "@/lib/ai/claude";
import {
  GeneratedMotionsResponseSchema,
  GeneratedScaffoldResponseSchema,
  type GeneratedMotionCard,
  type GeneratedSides,
} from "@/lib/schemas";
import { generateMotionsPrompt } from "@/lib/prompts/generateMotions";
import { generateScaffoldPrompt } from "@/lib/prompts/generateScaffold";
import type { z } from "zod";

export type MotionsResult =
  | { refused: false; motions: GeneratedMotionCard[] }
  | { refused: true; reason: string };

export type ScaffoldResult =
  | { refused: false; sides: GeneratedSides }
  | { refused: true; reason: string };

function parseJSONLoose(raw: string): unknown {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error("model returned non-JSON output");
  }
}

/** complete → JSON parse → Zod validate, with one repair retry. */
async function runStructured<S extends z.ZodTypeAny>(
  client: ChatClient,
  system: string,
  user: string,
  schema: S
): Promise<z.infer<S>> {
  const attempt = async (extra?: string): Promise<unknown> => {
    const raw = await client.complete({ system: extra ? `${system}\n\n${extra}` : system, user });
    return parseJSONLoose(raw);
  };

  let data: unknown;
  try {
    data = await attempt();
  } catch {
    data = await attempt("Your previous output was not valid JSON. Return ONLY the JSON object, nothing else.");
  }

  let result = schema.safeParse(data);
  if (result.success) return result.data;

  data = await attempt(
    `Your previous output did not match the required shape. Errors: ${JSON.stringify(result.error.issues).slice(0, 500)}. Return ONLY corrected JSON.`
  );
  result = schema.safeParse(data);
  if (result.success) return result.data;

  throw new Error("generation failed validation after repair");
}

export async function generateMotions(universe: string, client: ChatClient): Promise<MotionsResult> {
  const { system, user } = generateMotionsPrompt(universe);
  const data = await runStructured(client, system, user, GeneratedMotionsResponseSchema);
  return "refused" in data ? { refused: true, reason: data.reason } : { refused: false, motions: data.motions };
}

export async function generateScaffold(
  universe: string,
  motion: string,
  client: ChatClient
): Promise<ScaffoldResult> {
  const { system, user } = generateScaffoldPrompt(universe, motion);
  const data = await runStructured(client, system, user, GeneratedScaffoldResponseSchema);
  return "refused" in data ? { refused: true, reason: data.reason } : { refused: false, sides: data.sides };
}
