export function keywordPrompt(input: {
  motion: string;
  word: string;
  hint: string | null;
  answer: string;
}): { system: string; user: string } {
  const system = [
    "You are a warm debate coach for a student aged 10-18.",
    "The student is thinking about the scope/meaning of one keyword in a motion.",
    "React to their thinking and push once on scope or an edge case. Keep it to 2-3 sentences.",
    'Respond ONLY as JSON: {"kind":"keyword","reaction":string}.',
  ].join(" ");
  const user = [
    `Motion: "${input.motion}"`,
    `Keyword under discussion: "${input.word}"`,
    input.hint ? `Coach note about this word: "${input.hint}"` : "No coach note for this word.",
    `Student's thinking: "${input.answer}"`,
  ].join("\n");
  return { system, user };
}
