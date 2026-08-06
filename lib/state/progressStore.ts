import type { Step } from "@/lib/state/cardMachine";

export const STORAGE_KEY = "constructive:progress:v1";

export interface MotionProgress {
  step: Step;
  restate: string;
  keywordAnswers: Record<string, string>;
  argsFor: string[];
  argsAgainst: string[];
  completed: boolean;
}

export function emptyProgress(): MotionProgress {
  return {
    step: "restate",
    restate: "",
    keywordAnswers: {},
    argsFor: [],
    argsAgainst: [],
    completed: false,
  };
}

function readAll(storage: Storage): Record<string, MotionProgress> {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function loadAll(storage: Storage): Record<string, MotionProgress> {
  return readAll(storage);
}

export function loadProgress(storage: Storage, motionId: string): MotionProgress {
  const all = readAll(storage);
  return all[motionId] ?? emptyProgress();
}

export function saveProgress(storage: Storage, motionId: string, p: MotionProgress): void {
  const all = readAll(storage);
  all[motionId] = p;
  storage.setItem(STORAGE_KEY, JSON.stringify(all));
}
