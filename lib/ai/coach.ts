import { restatePrompt } from "@/lib/prompts/restate";
import { keywordPrompt } from "@/lib/prompts/keyword";
import { refinePrompt } from "@/lib/prompts/refine";
import { CoachResponseSchema, type CoachRequest, type CoachResponse } from "@/lib/schemas";
import type { ChatClient } from "@/lib/ai/claude";

function buildPrompt(req: CoachRequest): { system: string; user: string } {
  const p = req.payload as Record<string, unknown>;
  switch (req.step) {
    case "restate":
      return restatePrompt({ motion: req.motion, restate: String(p.restate ?? "") });
    case "keyword":
      return keywordPrompt({
        motion: req.motion,
        word: String(p.word ?? ""),
        hint: (p.hint as string | null) ?? null,
        answer: String(p.answer ?? ""),
      });
    case "refine":
      return refinePrompt({
        motion: req.motion,
        argsFor: (p.argsFor as string[]) ?? [],
        argsAgainst: (p.argsAgainst as string[]) ?? [],
      });
  }
}

export async function runCoach(req: CoachRequest, client: ChatClient): Promise<CoachResponse> {
  const { system, user } = buildPrompt(req);
  const raw = await client.complete({ system, user });
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Coach returned non-JSON output");
  }
  return CoachResponseSchema.parse(parsed);
}
