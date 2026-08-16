import { z } from "zod";
import type { PracticePart } from "@/lib/practice";

export const PRACTICE_STORAGE_KEY = "constructive:practice:v1";

const PracticeCountsSchema = z.object({
  claim: z.number().int().nonnegative(),
  link: z.number().int().nonnegative(),
  impact: z.number().int().nonnegative(),
});
export type PracticeCounts = z.infer<typeof PracticeCountsSchema>;

function zero(): PracticeCounts {
  return { claim: 0, link: 0, impact: 0 };
}

export function loadPracticeCounts(storage: Storage): PracticeCounts {
  const raw = storage.getItem(PRACTICE_STORAGE_KEY);
  if (!raw) return zero();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return zero();
  }
  const r = PracticeCountsSchema.safeParse(parsed);
  return r.success ? r.data : zero();
}

export function incrementPracticeCount(storage: Storage, part: PracticePart): PracticeCounts {
  const counts = loadPracticeCounts(storage);
  const next: PracticeCounts = { ...counts, [part]: counts[part] + 1 };
  storage.setItem(PRACTICE_STORAGE_KEY, JSON.stringify(next));
  return next;
}
