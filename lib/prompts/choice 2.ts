/**
 * "Talk this through" on a multiple-choice Claim or Impact pick. The student
 * chose an option the bank marks as weak; the coach explains why in their own
 * words without simply naming the right answer.
 */
export function choicePrompt(input: {
  motion: string;
  side: string;
  part: "claim" | "impact";
  claim: string | null;
  chosen: string;
  verdictLabel: string;
  explanation: string;
  best: string;
}): { system: string; user: string } {
  const what = input.part === "claim" ? "a claim" : "an impact (the 'so what')";
  const system = [
    "You are a warm debate coach for a student aged 10-18.",
    `The student picked ${what} from a short list of options, and the one they picked is weaker than it looks.`,
    "In 2-3 sentences, help them see why it is weak, using the author's note as your guide.",
    "Acknowledge what makes the option tempting, then name the specific weakness.",
    "Do NOT quote or reveal the strongest option; leave the pick to them.",
    'Respond ONLY as JSON: {"kind":"choice","reaction":string}.',
  ].join(" ");
  const user = [
    `Motion: "${input.motion}"`,
    `Side: ${input.side}`,
    input.claim ? `Their claim: "${input.claim}"` : "",
    `Option they picked: "${input.chosen}"`,
    `Author's verdict: ${input.verdictLabel}`,
    `Author's note (paraphrase, do not quote): ${input.explanation}`,
    `The strongest option, for your reference only (never reveal it): "${input.best}"`,
  ]
    .filter(Boolean)
    .join("\n");
  return { system, user };
}
