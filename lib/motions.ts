import raw from "@/content/motions.json";
import { MotionsFileSchema, type Motion } from "@/lib/schemas";

// Validated once at module load; a malformed bank throws loudly here.
const motions: Motion[] = MotionsFileSchema.parse(raw);

export function getMotions(): Motion[] {
  return motions;
}

export function getMotion(id: string): Motion | undefined {
  return motions.find((m) => m.id === id);
}
