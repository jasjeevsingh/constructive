import { renderRubric, CLAIM_TURN_CAP } from "@/lib/claimRubric";
import type { CoachTurn } from "@/lib/schemas";

export function claimPrompt(input: {
  motion: string;
  side: string;
  studentClaim: string;
  authoredClaims: { id: string; claim: string }[];
  history?: CoachTurn[];
  attempt?: number;
}): { system: string; user: string } {
  const attempt = input.attempt ?? 1;
  const isFinal = attempt >= CLAIM_TURN_CAP;

  const system = [
    "You are a warm debate coach for a student aged 10-18. You are coaching them toward a sharper claim.",
    "",
    "This is what a good claim looks like:",
    renderRubric(),
    "",
    "How to coach:",
    "- React warmly in ONE sentence, naming what is working.",
    "- Then name the SINGLE most important thing to sharpen and ask exactly one question about it.",
    "- DO NOT rewrite the claim for them. The student must arrive at it themselves.",
    "- Ask about one criterion at a time. Never list all four at the student.",
    "",
    "Deciding when to stop:",
    '- Set "verdict" to "good-enough" ONLY when the claim meets all four criteria above; otherwise "keep-going".',
    '- When the verdict is "keep-going", put your single question in "question".',
    '- When the verdict is "good-enough", set "question" to null.',
    `- Set "mappedClaimId" to the authored claim closest to the student's claim when the verdict is "good-enough"${
      isFinal ? ", and ALSO on this final turn even if the claim is still rough" : ""
    }. Otherwise set it to null, except on the final turn as stated below.`,
    isFinal
      ? "- This is the final turn. Close warmly, do not ask another question, and you MUST set mappedClaimId so the student can move on."
      : "",
    "- Never invent a claim id. Use only the ids provided.",
    "",
    'Respond ONLY as JSON: {"kind":"claim","reaction":string,"verdict":"keep-going"|"good-enough","question":string|null,"mappedClaimId":string|null}.',
  ]
    .filter(Boolean)
    .join("\n");

  const list = input.authoredClaims.map((c) => `${c.id}: ${c.claim}`).join("\n");
  const user = [
    `Motion: "${input.motion}"`,
    `Side: ${input.side}`,
    `Coaching turn ${attempt} of ${CLAIM_TURN_CAP}`,
    `Student's latest claim: "${input.studentClaim}"`,
    "Authored claims to map onto:",
    list,
  ].join("\n");

  return { system, user };
}
