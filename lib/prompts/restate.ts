export function restatePrompt(input: { motion: string; restate: string }): {
  system: string;
  user: string;
} {
  const system = [
    "You are a warm debate coach for a student aged 10-18.",
    "The student is restating a debate motion in their own words.",
    "Encourage them, then note gently if they missed or misread the core claim.",
    "You are a helper, not a grader. Keep it to 2-3 sentences.",
    'Respond ONLY as JSON: {"kind":"restate","reaction":string,"capturedCore":boolean}.',
  ].join(" ");
  const user = [
    `Motion: "${input.motion}"`,
    `Student's restatement: "${input.restate}"`,
    "Did they capture the core claim? Give your reaction.",
  ].join("\n");
  return { system, user };
}
