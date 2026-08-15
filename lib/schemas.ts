import { z } from "zod";

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

export const CoachStepSchema = z.enum(["restate", "keyword", "refine", "link", "claim", "impact"]);
export type CoachStep = z.infer<typeof CoachStepSchema>;

export const CoachRequestSchema = z.object({
  step: CoachStepSchema,
  motion: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
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
export const ClaimResponseSchema = z.object({
  kind: z.literal("claim"),
  reaction: z.string(),
  mappedClaimId: z.string(),
});
export const ImpactResponseSchema = z.object({
  kind: z.literal("impact"),
  reaction: z.string(),
});
export const CoachResponseSchema = z.discriminatedUnion("kind", [
  RestateResponseSchema,
  KeywordResponseSchema,
  RefineResponseSchema,
  LinkResponseSchema,
  ClaimResponseSchema,
  ImpactResponseSchema,
]);
export type CoachResponse = z.infer<typeof CoachResponseSchema>;
export type RefineVerdict = z.infer<typeof RefineVerdictSchema>;

export const LinkMaterialSchema = z.enum(["evidence", "reasoning"]);
export type LinkMaterial = z.infer<typeof LinkMaterialSchema>;

export const LinkVerdictSchema = z.enum(["fits", "doesnt-fit", "great-but-wrong"]);
export type LinkVerdict = z.infer<typeof LinkVerdictSchema>;

export const LinkCandidateSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  material: LinkMaterialSchema,
  verdict: LinkVerdictSchema,
  explanation: z.string().min(1),
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

export const FlowClaimSchema = z.object({
  id: z.string().min(1),
  claim: z.string().min(1),
  impact: z.string().min(1),
  candidates: z.array(LinkCandidateSchema).min(2),
});
export type FlowClaim = z.infer<typeof FlowClaimSchema>;

export const FlowSideSchema = z.object({
  claims: z.array(FlowClaimSchema),
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
