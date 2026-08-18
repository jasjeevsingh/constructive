import { FLOW_STORAGE_KEY } from "@/lib/state/flowProgress";
import { PRACTICE_STORAGE_KEY } from "@/lib/state/practiceProgress";

/** The only fields of a stored flow entry that ever leave the device. Everything
 *  else — `restate`, `keywordAnswers`, `impact`, `readSubstep` — is the student's
 *  own free text (or a sub-step cursor into it) and must never reach the report. */
export type FeedbackFlowEntry = {
  side?: unknown;
  stage?: unknown;
  mappedClaimId?: unknown;
  forComplete?: unknown;
  againstComplete?: unknown;
};

export type FeedbackContext = {
  pathname: string;
  flow?: Record<string, FeedbackFlowEntry>;
  practice?: unknown;
};

/** Reads one JSON store, returning undefined for absent, unreadable, or malformed values. */
function readJson(storage: Storage, key: string): unknown {
  try {
    const raw = storage.getItem(key);
    if (!raw) return undefined;
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : undefined;
  } catch {
    return undefined;
  }
}

/** Projects one stored flow entry down to the fields we're allowed to send:
 *  side, stage, mappedClaimId, and the two completion flags. Drops the
 *  student's free text (`restate`, `keywordAnswers`, `impact`) and the
 *  `readSubstep` cursor into it. */
function pickFlowEntryFields(entry: unknown): FeedbackFlowEntry | undefined {
  if (!entry || typeof entry !== "object") return undefined;
  const e = entry as Record<string, unknown>;
  return {
    side: e.side,
    stage: e.stage,
    mappedClaimId: e.mappedClaimId,
    forComplete: e.forComplete,
    againstComplete: e.againstComplete,
  };
}

function projectFlow(flow: unknown): Record<string, FeedbackFlowEntry> | undefined {
  if (!flow || typeof flow !== "object") return undefined;
  const out: Record<string, FeedbackFlowEntry> = {};
  for (const [motionId, entry] of Object.entries(flow as Record<string, unknown>)) {
    const picked = pickFlowEntryFields(entry);
    if (picked) out[motionId] = picked;
  }
  return out;
}

/**
 * Snapshot of where the tester is, attached to every report. Never throws — a
 * broken store is exactly when someone is most likely to file feedback.
 *
 * Per motion, only `side`, `stage`, `mappedClaimId`, `forComplete`, and
 * `againstComplete` are included — never the student's own writing
 * (`restate`, `keywordAnswers`, `impact`), and never for motions beyond the
 * ones already in the store.
 */
export function collectFeedbackContext(storage: Storage, pathname: string): FeedbackContext {
  const ctx: FeedbackContext = { pathname };
  const flow = projectFlow(readJson(storage, FLOW_STORAGE_KEY));
  if (flow) ctx.flow = flow;
  const practice = readJson(storage, PRACTICE_STORAGE_KEY);
  if (practice) ctx.practice = practice;
  return ctx;
}
