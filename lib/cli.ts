/**
 * The participant-facing Claim → Link → Impact definitions (Manmeet's
 * simplified wording, Sept 2026). Single source so the landing strip, the
 * lesson, and the in-journey cheat sheet never drift apart.
 */
export type CliPart = "claim" | "link" | "impact";

export const CLI_PARTS: CliPart[] = ["claim", "link", "impact"];

export const CLI_DEFINITIONS: Record<CliPart, { label: string; tag: string; definition: string }> = {
  claim: {
    label: "Claim",
    tag: 'The "What"',
    definition: "The main point you want the audience to believe.",
  },
  link: {
    label: "Link",
    tag: 'The "How"',
    definition: "The step-by-step logic that connects your claim to the real world.",
  },
  impact: {
    label: "Impact",
    tag: 'The "So What?"',
    definition: "The final consequence that shows why your argument actually matters.",
  },
};
