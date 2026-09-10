export type FlowStage = "claim" | "link" | "impact";
export type Side = "for" | "against";

/** The journey is Claim → Link → Impact. The old "Read the motion" stage was
 *  retired after the Sept 2026 live test: students wanted to jump straight to
 *  their claim, and key terms now live as an optional strip on the Claim stage. */
export const STAGES: FlowStage[] = ["claim", "link", "impact"];
export const SIDES: Side[] = ["for", "against"];

/** Stage name stored by pre-retirement clients; loads as "claim". */
export const LEGACY_READ_STAGE = "read";

export const STAGE_LABELS: Record<FlowStage, string> = {
  claim: "Claim",
  link: "Link",
  impact: "Impact",
};

export function isFlowStage(v: unknown): v is FlowStage {
  return typeof v === "string" && (STAGES as string[]).includes(v);
}

export function stageIndex(s: FlowStage): number {
  return STAGES.indexOf(s);
}
export function nextStage(s: FlowStage): FlowStage {
  return STAGES[Math.min(stageIndex(s) + 1, STAGES.length - 1)];
}
export function prevStage(s: FlowStage): FlowStage {
  return STAGES[Math.max(stageIndex(s) - 1, 0)];
}
export function isLastStage(s: FlowStage): boolean {
  return stageIndex(s) === STAGES.length - 1;
}
export function otherSideUnlocked(p: { forComplete: boolean; againstComplete: boolean }): boolean {
  return p.forComplete || p.againstComplete;
}
