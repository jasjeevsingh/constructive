import type { FlowMotion, LinkScenario } from "@/lib/schemas";
import type { Side } from "@/lib/state/flowMachine";
import { claimToScenario } from "@/lib/flowMotions";

export type PracticePart = "claim" | "link" | "impact";

export type PracticeItem =
  | { part: "claim"; motion: string; side: Side; claims: { id: string; claim: string }[] }
  | { part: "link"; scenario: LinkScenario }
  | { part: "impact"; motion: string; claim: string; authoredImpact: string };

const SIDES: Side[] = ["for", "against"];

function pick<T>(arr: T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length)];
}

/**
 * Draw a random practice item of the given part from the seeded bank.
 * `rand` is injected for deterministic tests (defaults to Math.random).
 * Only motions/sides that actually have claims are eligible.
 */
export function drawItem(
  part: PracticePart,
  motions: FlowMotion[],
  rand: () => number = Math.random
): PracticeItem {
  const usable = motions.filter((m) => SIDES.some((s) => m.sides[s].claims.length > 0));
  if (usable.length === 0) throw new Error("no practice content available");

  const motion = pick(usable, rand);
  const sidesWithClaims = SIDES.filter((s) => motion.sides[s].claims.length > 0);
  const side = pick(sidesWithClaims, rand);
  const claims = motion.sides[side].claims;

  if (part === "claim") {
    return {
      part: "claim",
      motion: motion.motion,
      side,
      claims: claims.map((c) => ({ id: c.id, claim: c.claim })),
    };
  }

  const claim = pick(claims, rand);
  if (part === "link") {
    // Practice-namespaced id keeps drill Link progress isolated from the journey.
    return { part: "link", scenario: claimToScenario(`practice:${motion.id}`, claim) };
  }
  return { part: "impact", motion: motion.motion, claim: claim.claim, authoredImpact: claim.impact };
}
