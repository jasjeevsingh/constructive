export const LINK_STORAGE_KEY = "constructive:link:v1";

export interface LinkProgress {
  placedIds: string[];
  held: boolean;
}

export function emptyLinkProgress(): LinkProgress {
  return { placedIds: [], held: false };
}

function readAll(storage: Storage): Record<string, LinkProgress> {
  const raw = storage.getItem(LINK_STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
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
