/**
 * The eight MPLR "penalty card" fallacies. Definitions and examples match the
 * printed cards (see feedback-and-visuals-feedback/logical fallacy Cards), so
 * what a student sees in the app is what they see at the retreat.
 */
export const FALLACY_IDS = [
  "straw-man",
  "slippery-slope",
  "false-dilemma",
  "false-cause",
  "appeal-to-authority",
  "hasty-generalization",
  "ad-hominem",
  "bandwagon",
] as const;

export type FallacyId = (typeof FALLACY_IDS)[number];

export type Fallacy = {
  id: FallacyId;
  name: string;
  definition: string;
  example: string;
  /** Red is the most serious foul, like a soccer red card. */
  card: "yellow" | "red";
};

export const FALLACIES: Record<FallacyId, Fallacy> = {
  "straw-man": {
    id: "straw-man",
    name: "Straw Man",
    definition: "You changed what they said, then argued against your version.",
    example: "So you're saying kids should just sit around doing nothing after school?",
    card: "yellow",
  },
  "slippery-slope": {
    id: "slippery-slope",
    name: "Slippery Slope",
    definition: "You jumped from one thing to a disaster without proving the steps.",
    example: "If we ban homework, students will stop studying entirely and never get into college.",
    card: "yellow",
  },
  "false-dilemma": {
    id: "false-dilemma",
    name: "False Dilemma",
    definition: "You said there are only two choices. There aren't.",
    example: "Either homework stays exactly as it is, or students learn absolutely nothing at home.",
    card: "yellow",
  },
  "false-cause": {
    id: "false-cause",
    name: "False Cause",
    definition: "Two things happened together. That doesn't mean one caused the other.",
    example: "Countries with less homework have higher scores — proof that homework makes students fail.",
    card: "yellow",
  },
  "appeal-to-authority": {
    id: "appeal-to-authority",
    name: "Appeal to Authority",
    definition: "You cited someone impressive without saying what they actually found.",
    example: "Stanford researchers say homework is harmful, so we should ban it.",
    card: "yellow",
  },
  "hasty-generalization": {
    id: "hasty-generalization",
    name: "Hasty Generalization",
    definition: "You drew a big conclusion from too little evidence.",
    example: "Every student I know hates homework — so clearly all homework is harmful for all students.",
    card: "yellow",
  },
  "ad-hominem": {
    id: "ad-hominem",
    name: "Ad Hominem",
    definition: "You attacked the person, not their argument.",
    example: "Of course teachers support homework — they don't have to do it themselves.",
    card: "red",
  },
  bandwagon: {
    id: "bandwagon",
    name: "Bandwagon",
    definition: "You said it's right because many people believe it. Popularity isn't logic.",
    example: "Most students say they want less homework — so homework should clearly be banned.",
    card: "yellow",
  },
};

export function isFallacyId(v: unknown): v is FallacyId {
  return typeof v === "string" && (FALLACY_IDS as readonly string[]).includes(v);
}

/** One line per fallacy, for splicing into coach prompts. */
export function renderFallacyList(): string {
  return FALLACY_IDS.map((id) => `- ${id}: ${FALLACIES[id].definition}`).join("\n");
}
