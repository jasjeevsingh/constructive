export const LINK_STORAGE_KEY = "constructive:link:v1";

export interface LinkProgress {
  placedIds: string[];
  held: boolean;
}

export function emptyLinkProgress(): LinkProgress {
  return { placedIds: [], held: false };
}

function isValidEntry(value: unknown): value is LinkProgress {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  return (
    Array.isArray(entry.placedIds) &&
    entry.placedIds.every((id) => typeof id === "string") &&
    typeof entry.held === "boolean"
  );
}

function readAll(storage: Storage): Record<string, LinkProgress> {
  const raw = storage.getItem(LINK_STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const result: Record<string, LinkProgress> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (isValidEntry(value)) result[key] = value;
    }
    return result;
  } catch {
    return {};
  }
}

export function loadLinkProgress(storage: Storage, scenarioId: string): LinkProgress {
  return readAll(storage)[scenarioId] ?? emptyLinkProgress();
}

export function saveLinkProgress(storage: Storage, scenarioId: string, p: LinkProgress): void {
  const all = readAll(storage);
  all[scenarioId] = p;
  storage.setItem(LINK_STORAGE_KEY, JSON.stringify(all));
}
