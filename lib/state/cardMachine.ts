export type Step = "restate" | "keyword" | "arguments";

export const STEPS: Step[] = ["restate", "keyword", "arguments"];

export function stepIndex(s: Step): number {
  return STEPS.indexOf(s);
}

export function nextStep(s: Step): Step {
  const i = stepIndex(s);
  return STEPS[Math.min(i + 1, STEPS.length - 1)];
}

export function prevStep(s: Step): Step {
  const i = stepIndex(s);
  return STEPS[Math.max(i - 1, 0)];
}

export function isLastStep(s: Step): boolean {
  return stepIndex(s) === STEPS.length - 1;
}
