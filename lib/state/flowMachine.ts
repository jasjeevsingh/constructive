export type FlowStage = "read" | "claim" | "link" | "impact";
export type ReadSubstep = "restate" | "keyword";
export type Side = "for" | "against";

export const STAGES: FlowStage[] = ["read", "claim", "link", "impact"];
export const READ_SUBSTEPS: ReadSubstep[] = ["restate", "keyword"];
export const SIDES: Side[] = ["for", "against"];

export const STAGE_LABELS: Record<FlowStage, string> = {
  read: "Read the motion",
  claim: "Claim",
  link: "Link",
  impact: "Impact",
};

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
