import raw from "@/content/flow-motions.json";
import {
  FlowMotionsFileSchema,
  type FlowMotion,
  type FlowClaim,
  type Motion,
  type LinkScenario,
} from "@/lib/schemas";

// Validated once at import; a malformed bank throws loudly here.
const motions: FlowMotion[] = FlowMotionsFileSchema.parse(raw);

export function getFlowMotions(): FlowMotion[] {
  return motions;
}

export function getFlowMotion(id: string): FlowMotion | undefined {
  return motions.find((m) => m.id === id);
}

/** KeywordStep expects a Motion; flow motions carry the same fields plus a fixed theme. */
export function flowMotionToMotion(fm: FlowMotion): Motion {
  return { id: fm.id, motion: fm.motion, keywords: fm.keywords, theme: "general" };
}

/**
 * LinkCard expects a LinkScenario; an authored claim already carries that shape.
 * Claim ids are not globally unique across motions, so the scenario id is
 * namespaced by motion id to keep per-motion Link progress (localStorage) from
 * colliding across motions that happen to share a claim id.
 */
export function claimToScenario(motionId: string, claim: FlowClaim): LinkScenario {
  return { id: `${motionId}:${claim.id}`, claim: claim.claim, impact: claim.impact, candidates: claim.candidates };
}
