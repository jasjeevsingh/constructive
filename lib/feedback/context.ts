import { FLOW_STORAGE_KEY } from "@/lib/state/flowProgress";

const PRACTICE_STORAGE_KEY = "constructive:practice:v1";

export type FeedbackContext = {
  pathname: string;
  flow?: Record<string, unknown>;
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

/**
 * Snapshot of where the tester is, attached to every report. Never throws — a
 * broken store is exactly when someone is most likely to file feedback.
 */
export function collectFeedbackContext(storage: Storage, pathname: string): FeedbackContext {
  const ctx: FeedbackContext = { pathname };
  const flow = readJson(storage, FLOW_STORAGE_KEY);
  if (flow) ctx.flow = flow as Record<string, unknown>;
  const practice = readJson(storage, PRACTICE_STORAGE_KEY);
  if (practice) ctx.practice = practice;
  return ctx;
}
