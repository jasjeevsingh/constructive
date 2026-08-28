import type { AvatarSession, AvatarMode } from "@/lib/avatar/types";

export const AVATAR_STORAGE_KEY = "constructive:avatar:v1";

function readAll(storage: Storage): Record<string, AvatarSession> {
  const raw = storage.getItem(AVATAR_STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Record<string, AvatarSession>;
  } catch {
    return {};
  }
}

export function saveAvatarSession(storage: Storage, session: AvatarSession): void {
  const all = readAll(storage);
  all[session.id] = session;
  storage.setItem(AVATAR_STORAGE_KEY, JSON.stringify(all));
}

export function loadAvatarSession(storage: Storage, id: string): AvatarSession | null {
  return readAll(storage)[id] ?? null;
}

export function listAvatarSessions(
  storage: Storage,
): Array<{ id: string; mode: AvatarMode; motionText: string; startedAt: number }> {
  const all = readAll(storage);
  return Object.values(all)
    .map((s) => ({ id: s.id, mode: s.mode, motionText: s.motionText, startedAt: s.startedAt }))
    .sort((a, b) => b.startedAt - a.startedAt);
}
