import { z } from "zod";
import { KeywordSchema, GeneratedSidesSchema } from "@/lib/schemas";
import { slug } from "@/lib/generatedNormalize";

export const GENERATED_STORAGE_KEY = "constructive:universes:v1";

const StoredMotionCardSchema = z.object({
  id: z.string().min(1),
  motion: z.string().min(1),
  keywords: z.array(KeywordSchema),
  hook: z.string().min(1),
  sides: GeneratedSidesSchema.nullable(),
});
export type StoredMotionCard = z.infer<typeof StoredMotionCardSchema>;

const GeneratedUniverseSchema = z.object({
  universe: z.string().min(1),
  createdAt: z.string(),
  motions: z.array(StoredMotionCardSchema),
});
export type GeneratedUniverse = z.infer<typeof GeneratedUniverseSchema>;

export type GeneratedStore = Record<string, GeneratedUniverse>;

export function loadUniverses(storage: Storage): GeneratedStore {
  const raw = storage.getItem(GENERATED_STORAGE_KEY);
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (typeof parsed !== "object" || parsed === null) return {};
  const out: GeneratedStore = {};
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    const r = GeneratedUniverseSchema.safeParse(value);
    if (r.success) out[key] = r.data;
  }
  return out;
}

export function saveUniverses(storage: Storage, store: GeneratedStore): void {
  storage.setItem(GENERATED_STORAGE_KEY, JSON.stringify(store));
}

export function universeKey(universe: string): string {
  return slug(universe);
}
