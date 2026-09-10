import { isFlowStage, LEGACY_READ_STAGE, type FlowStage, type Side } from "@/lib/state/flowMachine";

export const FLOW_STORAGE_KEY = "constructive:flow:v1";

export interface FlowProgress {
  side: Side;
  stage: FlowStage;
  keywordAnswers: Record<string, string>;
  mappedClaimId: string | null;
  impact: string;
  forComplete: boolean;
  againstComplete: boolean;
}

export function emptyFlowProgress(startSide: Side = "for"): FlowProgress {
  return {
    side: startSide,
    stage: "claim",
    keywordAnswers: {},
    mappedClaimId: null,
    impact: "",
    forComplete: false,
    againstComplete: false,
  };
}

/** Accepts both current entries and pre-Sept-2026 entries that still carry the
 *  retired Read stage (`stage: "read"`, `readSubstep`, `restate`). Legacy
 *  entries land on Claim; their restatement text is dropped, not migrated. */
function normalizeEntry(v: unknown): FlowProgress | null {
  if (!v || typeof v !== "object") return null;
  const e = v as Record<string, unknown>;
  const stage = e.stage === LEGACY_READ_STAGE ? "claim" : e.stage;
  if (
    (e.side !== "for" && e.side !== "against") ||
    !isFlowStage(stage) ||
    typeof e.forComplete !== "boolean" ||
    typeof e.againstComplete !== "boolean" ||
    (e.mappedClaimId !== null && typeof e.mappedClaimId !== "string") ||
    !e.keywordAnswers ||
    typeof e.keywordAnswers !== "object"
  ) {
    return null;
  }
  return {
    side: e.side,
    stage,
    keywordAnswers: e.keywordAnswers as Record<string, string>,
    mappedClaimId: e.mappedClaimId as string | null,
    impact: typeof e.impact === "string" ? e.impact : "",
    forComplete: e.forComplete,
    againstComplete: e.againstComplete,
  };
}

function readAll(storage: Storage): Record<string, FlowProgress> {
  const raw = storage.getItem(FLOW_STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, FlowProgress> = {};
    for (const [k, v] of Object.entries(parsed)) {
      const entry = normalizeEntry(v);
      if (entry) out[k] = entry;
    }
    return out;
  } catch {
    return {};
  }
}

export function loadFlowProgress(
  storage: Storage,
  motionId: string,
  startSide: Side = "for"
): FlowProgress {
  return readAll(storage)[motionId] ?? emptyFlowProgress(startSide);
}

export function saveFlowProgress(storage: Storage, motionId: string, p: FlowProgress): void {
  const all = readAll(storage);
  all[motionId] = p;
  storage.setItem(FLOW_STORAGE_KEY, JSON.stringify(all));
}

export function hasFlowProgress(storage: Storage, motionId: string): boolean {
  return readAll(storage)[motionId] !== undefined;
}

/** Drops every entry whose motion id starts with `prefix` (used when a generated universe is rebuilt, since its ids are reused). */
export function clearFlowProgressForPrefix(storage: Storage, prefix: string): void {
  const all = readAll(storage);
  let changed = false;
  for (const key of Object.keys(all)) {
    if (key.startsWith(prefix)) {
      delete all[key];
      changed = true;
    }
  }
  if (changed) storage.setItem(FLOW_STORAGE_KEY, JSON.stringify(all));
}

export type MotionStatus = "not-started" | "in-progress" | "one-side-done" | "complete";

export function loadAllFlowProgress(storage: Storage): Record<string, FlowProgress> {
  return readAll(storage);
}

export function motionStatus(entry: FlowProgress | undefined): MotionStatus {
  if (!entry) return "not-started";
  if (entry.forComplete && entry.againstComplete) return "complete";
  if (entry.forComplete || entry.againstComplete) return "one-side-done";
  return "in-progress";
}

/** True once the student has moved past the Claim stage on any motion, or
 *  finished a side. Used to decide whether the CLI cheat sheet opens by default. */
export function hasAdvancedAnywhere(storage: Storage): boolean {
  return Object.values(readAll(storage)).some(
    (p) => p.stage !== "claim" || p.forComplete || p.againstComplete
  );
}
