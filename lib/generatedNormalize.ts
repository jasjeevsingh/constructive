import type { FlowMotion, FlowClaim, LinkCandidate, Keyword, GeneratedSides } from "@/lib/schemas";

export class ScaffoldError extends Error {}

export function slug(input: string): string {
  const s = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return s || "universe";
}

export function motionCardId(universe: string, index: number): string {
  return `gen:${slug(universe)}:${index}`;
}

/**
 * Motions must read "This House ..." — the generator sometimes lowercases it.
 * Only the two words are rewritten; the following verb keeps its own case so
 * the seeded convention ("This House would") is preserved. Idempotent.
 */
export function normalizeMotionText(motion: string): string {
  return motion.replace(/\bthis\s+house\b/gi, "This House");
}

/** Solvable = ≥1 fitting evidence, ≥1 fitting reasoning, ≥1 non-fitting distractor. */
export function claimIsSolvable(candidates: readonly { material: string; verdict: string }[]): boolean {
  const fitEvidence = candidates.some((c) => c.material === "evidence" && c.verdict === "fits");
  const fitReasoning = candidates.some((c) => c.material === "reasoning" && c.verdict === "fits");
  const distractor = candidates.some((c) => c.verdict !== "fits");
  return fitEvidence && fitReasoning && distractor;
}

/** Drops unsolvable claims; throws ScaffoldError if either side ends up empty. */
export function enforceSolvableSides(sides: GeneratedSides): GeneratedSides {
  const clean = (claims: GeneratedSides["for"]["claims"]) => claims.filter((c) => claimIsSolvable(c.candidates));
  const forClaims = clean(sides.for.claims);
  const againstClaims = clean(sides.against.claims);
  if (forClaims.length === 0 || againstClaims.length === 0) {
    throw new ScaffoldError("generated scaffold had no solvable claim on a side");
  }
  return { for: { claims: forClaims }, against: { claims: againstClaims } };
}

/**
 * Assemble a FlowMotion from an already-solvable (enforced) sides object,
 * assigning deterministic ids. Callers pass sides that have been run through
 * enforceSolvableSides.
 */
export function assembleFlowMotion(
  motionId: string,
  motion: string,
  keywords: Keyword[],
  sides: GeneratedSides
): FlowMotion {
  const build = (claims: GeneratedSides["for"]["claims"]): FlowClaim[] =>
    claims.map((c, ci) => {
      let ev = 0;
      let re = 0;
      const candidates: LinkCandidate[] = c.candidates.map((cand) => ({
        id: cand.material === "evidence" ? `e${++ev}` : `r${++re}`,
        text: cand.text,
        material: cand.material,
        verdict: cand.verdict,
        explanation: cand.explanation,
      }));
      return { id: `c${ci + 1}`, claim: c.claim, impact: c.impact, candidates };
    });
  return {
    id: motionId,
    motion: normalizeMotionText(motion),
    keywords,
    sides: { for: { claims: build(sides.for.claims) }, against: { claims: build(sides.against.claims) } },
  };
}
