export function impactPrompt(input: {
  motion: string;
  claim: string;
  authoredImpact: string;
  studentImpact: string;
}): { system: string; user: string } {
  const system = [
    "You are a warm debate coach for a student aged 10-18.",
    "The student is stating the impact — the 'so what' — that follows from their claim.",
    "React in 2-3 sentences: affirm what connects, and nudge once toward a broader or deeper consequence.",
    "Do not give the answer away; help them see it.",
    'Respond ONLY as JSON: {"kind":"impact","reaction":string}.',
  ].join(" ");
  const user = [
    `Motion: "${input.motion}"`,
    `Their claim: "${input.claim}"`,
    `A strong impact for reference (do not quote verbatim): "${input.authoredImpact}"`,
    `Student's impact: "${input.studentImpact}"`,
  ].join("\n");
  return { system, user };
}
