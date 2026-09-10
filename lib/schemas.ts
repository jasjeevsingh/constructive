import { z } from "zod";
import { FALLACY_IDS } from "@/lib/fallacies";

export const KeywordSchema = z.object({
  word: z.string().min(1),
  hint: z.string().min(1).nullable(),
});
export type Keyword = z.infer<typeof KeywordSchema>;

export const MotionSchema = z.object({
  id: z.string().min(1),
  motion: z.string().min(1),
  keywords: z.array(KeywordSchema),
  theme: z.string().min(1),
});
export type Motion = z.infer<typeof MotionSchema>;

export const MotionsFileSchema = z.array(MotionSchema);

export const CoachStepSchema = z.enum(["restate", "keyword", "refine", "link", "claim", "impact", "choice"]);
export type CoachStep = z.infer<typeof CoachStepSchema>;

export const CoachTurnSchema = z.object({
  role: z.enum(["student", "coach"]),
  text: z.string().max(2000),
});
export type CoachTurn = z.infer<typeof CoachTurnSchema>;

export const CoachRequestSchema = z.object({
  step: CoachStepSchema,
  motion: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
  history: z.array(CoachTurnSchema).max(10).optional(),
});
export type CoachRequest = z.infer<typeof CoachRequestSchema>;

export const RestateResponseSchema = z.object({
  kind: z.literal("restate"),
  reaction: z.string(),
  capturedCore: z.boolean(),
});
export const KeywordResponseSchema = z.object({
  kind: z.literal("keyword"),
  reaction: z.string(),
});
export const RefineVerdictSchema = z.object({
  argumentId: z.string(),
  verdict: z.enum(["distinct", "weak", "duplicate"]),
  question: z.string().nullable(),
});
export const RefineResponseSchema = z.object({
  kind: z.literal("refine"),
  verdicts: z.array(RefineVerdictSchema),
  duplicateGroups: z.array(z.array(z.string())),
});
export const LinkResponseSchema = z.object({
  kind: z.literal("link"),
  reaction: z.string(),
});
/** Loose on purpose: a hallucinated id must not fail the whole coach reply; the UI ignores unknown ids. */
const LooseFallacy = z.string().nullable().optional();

export const ClaimResponseSchema = z.object({
  kind: z.literal("claim"),
  reaction: z.string(),
  verdict: z.enum(["keep-going", "good-enough"]),
  question: z.string().nullable(),
  mappedClaimId: z.string().nullable(),
  fallacy: LooseFallacy,
});
export const ImpactResponseSchema = z.object({
  kind: z.literal("impact"),
  reaction: z.string(),
  fallacy: LooseFallacy,
});
export const ChoiceResponseSchema = z.object({
  kind: z.literal("choice"),
  reaction: z.string(),
});
export const CoachResponseSchema = z.discriminatedUnion("kind", [
  RestateResponseSchema,
  KeywordResponseSchema,
  RefineResponseSchema,
  LinkResponseSchema,
  ClaimResponseSchema,
  ImpactResponseSchema,
  ChoiceResponseSchema,
]);
export type CoachResponse = z.infer<typeof CoachResponseSchema>;
export type RefineVerdict = z.infer<typeof RefineVerdictSchema>;

export const LinkMaterialSchema = z.enum(["evidence", "reasoning"]);
export type LinkMaterial = z.infer<typeof LinkMaterialSchema>;

export const LinkVerdictSchema = z.enum(["fits", "doesnt-fit", "great-but-wrong"]);
export type LinkVerdict = z.infer<typeof LinkVerdictSchema>;

export const FallacyIdSchema = z.enum(FALLACY_IDS);

export const LinkCandidateSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  material: LinkMaterialSchema,
  verdict: LinkVerdictSchema,
  explanation: z.string().min(1),
  /** Set only on distractors that honestly commit a named fallacy; surfaces a penalty card when placed. */
  fallacy: FallacyIdSchema.optional(),
});
export type LinkCandidate = z.infer<typeof LinkCandidateSchema>;

export const LinkScenarioSchema = z.object({
  id: z.string().min(1),
  claim: z.string().min(1),
  impact: z.string().min(1),
  candidates: z.array(LinkCandidateSchema).min(2),
});
export type LinkScenario = z.infer<typeof LinkScenarioSchema>;

export const LinkScenariosFileSchema = z.array(LinkScenarioSchema);

// --- Multiple-choice Claim and Impact (seeded bank only; generated motions stay open-input) ---

export const ClaimChoiceVerdictSchema = z.enum(["strong", "too-broad", "not-contestable", "wrong-side"]);
export type ClaimChoiceVerdict = z.infer<typeof ClaimChoiceVerdictSchema>;
export const ImpactChoiceVerdictSchema = z.enum(["strong", "restates-claim", "different-claim", "no-scale"]);
export type ImpactChoiceVerdict = z.infer<typeof ImpactChoiceVerdictSchema>;

export const ClaimChoiceSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  verdict: ClaimChoiceVerdictSchema,
  explanation: z.string().min(1),
  /** The authored claim this option stands for; required (and only meaningful) on the strong option. */
  claimId: z.string().min(1).optional(),
});
export type ClaimChoice = z.infer<typeof ClaimChoiceSchema>;

export const ImpactChoiceSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  verdict: ImpactChoiceVerdictSchema,
  explanation: z.string().min(1),
});
export type ImpactChoice = z.infer<typeof ImpactChoiceSchema>;

function exactlyOneStrong(choices: { verdict: string }[]): boolean {
  return choices.filter((c) => c.verdict === "strong").length === 1;
}

export const FlowClaimSchema = z.object({
  id: z.string().min(1),
  claim: z.string().min(1),
  impact: z.string().min(1),
  candidates: z.array(LinkCandidateSchema).min(2),
  impactChoices: z
    .array(ImpactChoiceSchema)
    .min(2)
    .refine(exactlyOneStrong, { message: "impactChoices needs exactly one strong option" })
    .optional(),
});
export type FlowClaim = z.infer<typeof FlowClaimSchema>;

export const FlowSideSchema = z
  .object({
    claims: z.array(FlowClaimSchema),
    claimChoices: z
      .array(ClaimChoiceSchema)
      .min(2)
      .refine(exactlyOneStrong, { message: "claimChoices needs exactly one strong option" })
      .optional(),
  })
  .superRefine((side, ctx) => {
    const strong = side.claimChoices?.find((c) => c.verdict === "strong");
    if (!strong) return;
    if (!strong.claimId || !side.claims.some((c) => c.id === strong.claimId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["claimChoices"],
        message: "the strong claim choice must name an authored claim id on this side",
      });
    }
  });

export const FlowMotionSchema = z.object({
  id: z.string().min(1),
  motion: z.string().min(1),
  keywords: z.array(KeywordSchema),
  sides: z.object({ for: FlowSideSchema, against: FlowSideSchema }),
});
export type FlowMotion = z.infer<typeof FlowMotionSchema>;

export const FlowMotionsFileSchema = z.array(FlowMotionSchema);

// --- Fictional-universe generator (id-less generation variants; server assigns ids) ---

export const GeneratedMotionCardSchema = z.object({
  motion: z.string().min(1),
  keywords: z.array(KeywordSchema).min(1),
  hook: z.string().min(1),
});
export type GeneratedMotionCard = z.infer<typeof GeneratedMotionCardSchema>;

export const GeneratedCandidateSchema = z.object({
  text: z.string().min(1),
  material: LinkMaterialSchema,
  verdict: LinkVerdictSchema,
  explanation: z.string().min(1),
  fallacy: z.string().nullable().optional(),
});
export const GeneratedClaimSchema = z.object({
  claim: z.string().min(1),
  impact: z.string().min(1),
  candidates: z.array(GeneratedCandidateSchema).min(2),
});
export const GeneratedSideSchema = z.object({ claims: z.array(GeneratedClaimSchema).min(1) });
export const GeneratedSidesSchema = z.object({ for: GeneratedSideSchema, against: GeneratedSideSchema });
export type GeneratedSides = z.infer<typeof GeneratedSidesSchema>;

const GeneratedRefusalSchema = z.object({ refused: z.literal(true), reason: z.string().min(1) });

export const GeneratedMotionsResponseSchema = z.union([
  z.object({ motions: z.array(GeneratedMotionCardSchema).min(1).max(6) }),
  GeneratedRefusalSchema,
]);
export const GeneratedScaffoldResponseSchema = z.union([
  z.object({ sides: GeneratedSidesSchema }),
  GeneratedRefusalSchema,
]);

export const ClaimCriterionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  test: z.string().min(1),
  bad: z.string().min(1),
  good: z.string().min(1),
});
export const ClaimRubricSchema = z.object({
  version: z.number(),
  intro: z.string().min(1),
  criteria: z.array(ClaimCriterionSchema).min(1),
  /** Optional single claim that satisfies all criteria at once, for calibrating the combined bar. */
  exemplar: z.string().min(1).optional(),
});
export type ClaimCriterion = z.infer<typeof ClaimCriterionSchema>;
export type ClaimRubric = z.infer<typeof ClaimRubricSchema>;
