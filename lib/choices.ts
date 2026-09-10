import type { ClaimChoice, ClaimChoiceVerdict, ImpactChoice, ImpactChoiceVerdict } from "@/lib/schemas";

/** Short labels the student sees when an option is wrong. */
export const CLAIM_VERDICT_LABELS: Record<ClaimChoiceVerdict, string> = {
  strong: "Strong claim",
  "too-broad": "Too broad",
  "not-contestable": "Not contestable",
  "wrong-side": "Wrong side",
};

export const IMPACT_VERDICT_LABELS: Record<ImpactChoiceVerdict, string> = {
  strong: "Strong impact",
  "restates-claim": "Just restates the claim",
  "different-claim": "Belongs to a different claim",
  "no-scale": "No sense of scale",
};

/** The one option the bank marks as strong. Schemas guarantee exactly one exists. */
export function strongChoice<T extends { verdict: string }>(choices: T[]): T {
  const strong = choices.find((c) => c.verdict === "strong");
  if (!strong) throw new Error("choice set has no strong option");
  return strong;
}

export function verdictLabel(part: "claim" | "impact", verdict: string): string {
  return part === "claim"
    ? CLAIM_VERDICT_LABELS[verdict as ClaimChoiceVerdict] ?? verdict
    : IMPACT_VERDICT_LABELS[verdict as ImpactChoiceVerdict] ?? verdict;
}

/**
 * Deterministic rotation so the strong option isn't always listed first
 * (the bank lists it first for readability). Same seed, same order — keeps
 * tests stable and the order steady across re-renders.
 */
export function orderChoices<T>(choices: T[], seed: string): T[] {
  if (choices.length < 2) return choices;
  const n = seed.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const offset = n % choices.length;
  return [...choices.slice(offset), ...choices.slice(0, offset)];
}

export type AnyChoice = ClaimChoice | ImpactChoice;
