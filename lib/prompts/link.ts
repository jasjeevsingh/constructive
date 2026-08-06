export function linkPrompt(input: {
  claim: string;
  impact: string;
  candidateText: string;
  verdict: string;
}): { system: string; user: string } {
  const system = [
    "You are a warm debate coach for a student aged 10-18.",
    "The student is deciding whether one sentence is a good 'bridge' from a claim to an impact.",
    "Explain briefly whether it connects the claim to THIS impact, and why.",
    "If it sounds authoritative but does not fit (a 'great but wrong' trap), acknowledge why it's tempting, then show why it doesn't bridge.",
    "Keep it to 2-3 sentences; do not just give the answer away, help them see it.",
    'Respond ONLY as JSON: {"kind":"link","reaction":string}.',
  ].join(" ");
  const user = [
    `Claim: "${input.claim}"`,
    `Impact: "${input.impact}"`,
    `Candidate sentence: "${input.candidateText}"`,
    `(Author's verdict for your reference, do not quote it verbatim: ${input.verdict})`,
  ].join("\n");
  return { system, user };
}
