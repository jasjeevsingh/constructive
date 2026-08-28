import type { AvatarMode, Cohort, ModeConfig } from "@/lib/avatar/types";

const BASE_CONFIG: Record<AvatarMode, Omit<ModeConfig, "wordLimit" | "scaffoldingLevel">> = {
  sparring: { turnDurationSec: 60, rounds: 3, prepPauseSec: 15 },
  pushback: { turnDurationSec: 90, rounds: 1, prepPauseSec: 0 },
  collaborative: { turnDurationSec: 45, rounds: 2, prepPauseSec: 10 },
};

const COHORT_OVERRIDES: Record<Cohort, { wordLimit: number; scaffoldingLevel: ModeConfig["scaffoldingLevel"] }> = {
  surat: { wordLimit: 80, scaffoldingLevel: "high" },
  darshan: { wordLimit: 120, scaffoldingLevel: "medium" },
  pyaas: { wordLimit: 150, scaffoldingLevel: "low" },
};

export function getModeConfig(mode: AvatarMode, cohort: Cohort): ModeConfig {
  return { ...BASE_CONFIG[mode], ...COHORT_OVERRIDES[cohort] };
}

export interface CohortPromptModifiers {
  vocabulary: string;
  signposting: string;
  pushbackIntensity: string;
  scaffolding: string;
}

const MODIFIERS: Record<Cohort, CohortPromptModifiers> = {
  surat: {
    vocabulary: "Use simple, concrete language appropriate for 5th-7th graders (ages 10-12). Avoid abstract terms without explaining them.",
    signposting: "Use explicit signposting: 'My first point is...', 'The reason this matters is...', 'To sum up...'",
    pushbackIntensity: "Be gentle with challenges. Offer hints when pushing back: 'Can you tell me *why* that evidence supports your claim?'",
    scaffolding: "Use fill-in-the-blank prompts to guide brainstorming: 'My claim is that ___ because ___.'",
  },
  darshan: {
    vocabulary: "Use standard vocabulary appropriate for 8th-10th graders (ages 13-15). Define debate-specific terms briefly when first used.",
    signposting: "Use moderate signposting. Label your main points but don't over-scaffold.",
    pushbackIntensity: "Be direct with challenges. Ask pointed questions: 'What evidence supports that claim?'",
    scaffolding: "Use guided questions to shape brainstorming: 'What's the strongest reason someone would agree with this side?'",
  },
  pyaas: {
    vocabulary: "Use advanced, nuanced vocabulary appropriate for 11th-12th graders (ages 16-18). Engage as a peer.",
    signposting: "Use minimal signposting. Make arguments flow naturally without explicit labels.",
    pushbackIntensity: "Be sharp with challenges. Expect evidence and reasoning: 'That's an assertion, not evidence — what's the mechanism?'",
    scaffolding: "Brainstorm as peers: 'What angle hasn't been explored yet?' or 'How would you preempt the strongest counter?'",
  },
};

export function getCohortPromptModifiers(cohort: Cohort): CohortPromptModifiers {
  return MODIFIERS[cohort];
}
