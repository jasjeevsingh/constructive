import { restatePrompt } from "@/lib/prompts/restate";
import { keywordPrompt } from "@/lib/prompts/keyword";
import { refinePrompt } from "@/lib/prompts/refine";
import { linkPrompt } from "@/lib/prompts/link";
import { claimPrompt } from "@/lib/prompts/claim";
import { impactPrompt } from "@/lib/prompts/impact";
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
    case "link":
      return linkPrompt({
        claim: req.motion,
        impact: String(p.impact ?? ""),
        candidateText: String(p.candidateText ?? ""),
        verdict: String(p.verdict ?? ""),
      });
    case "claim":
      return claimPrompt({
        motion: req.motion,
        side: String(p.side ?? ""),
        studentClaim: String(p.studentClaim ?? ""),
        authoredClaims: (p.authoredClaims as { id: string; claim: string }[]) ?? [],
      });
    case "impact":
      return impactPrompt({
        motion: req.motion,
        claim: String(p.claim ?? ""),
        authoredImpact: String(p.authoredImpact ?? ""),
        studentImpact: String(p.studentImpact ?? ""),
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
  const result = CoachResponseSchema.parse(parsed);
  if (result.kind === "claim") {
    const ids = ((req.payload.authoredClaims as { id: string }[] | undefined) ?? []).map((c) => c.id);
    if (!ids.includes(result.mappedClaimId)) {
      throw new Error("coach mapped claim to an id outside the authored set");
    }
  }
  return result;
}
