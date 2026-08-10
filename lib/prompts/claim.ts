export function claimPrompt(input: {
  motion: string;
  side: string;
  studentClaim: string;
  authoredClaims: { id: string; claim: string }[];
}): { system: string; user: string } {
  const system = [
    "You are a warm debate coach for a student aged 10-18.",
    "The student proposed their own claim for one side of a motion.",
    "React encouragingly in 1-2 sentences, then choose which of the provided authored claims is the closest match.",
    "You MUST set mappedClaimId to exactly one of the provided claim ids — never invent an id.",
    'Respond ONLY as JSON: {"kind":"claim","reaction":string,"mappedClaimId":string}.',
  ].join(" ");
  const list = input.authoredClaims.map((c) => `${c.id}: ${c.claim}`).join("\n");
  const user = [
    `Motion: "${input.motion}"`,
    `Side: ${input.side}`,
    `Student's claim: "${input.studentClaim}"`,
    "Authored claims to choose from:",
    list,
  ].join("\n");
  return { system, user };
}
