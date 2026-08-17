import raw from "@/content/claim-rubric.json";
import { ClaimRubricSchema, type ClaimRubric } from "@/lib/schemas";

// Validated once at import; a malformed rubric throws loudly here.
const rubric: ClaimRubric = ClaimRubricSchema.parse(raw);

/** How many coaching turns a student gets before the loop lets them through. */
export const CLAIM_TURN_CAP = 3;

export function getClaimRubric(): ClaimRubric {
  return rubric;
}

/** The shared prompt block. Both the coach and the scaffold generator embed this, so they cannot drift. */
export function renderRubric(): string {
  const lines = rubric.criteria.map(
    (c) => `- ${c.name}: ${c.test}\n  Weak: "${c.bad}"\n  Strong: "${c.good}"`
  );
  const parts = [rubric.intro, "", ...lines];
  if (rubric.exemplar) {
    parts.push("", `A claim that meets the whole standard: "${rubric.exemplar}"`);
  }
  return parts.join("\n");
}
