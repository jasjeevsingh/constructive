import raw from "@/content/impact-rubric.json";
import { ClaimRubricSchema, type ClaimRubric } from "@/lib/schemas";

const rubric: ClaimRubric = ClaimRubricSchema.parse(raw);

export function getImpactRubric(): ClaimRubric {
  return rubric;
}

export function renderImpactRubric(): string {
  const lines = rubric.criteria.map(
    (c) => `- ${c.name}: ${c.test}\n  Weak: "${c.bad}"\n  Strong: "${c.good}"`
  );
  const parts = [rubric.intro, "", ...lines];
  if (rubric.exemplar) {
    parts.push("", `An impact that meets the whole standard: "${rubric.exemplar}"`);
  }
  return parts.join("\n");
}
