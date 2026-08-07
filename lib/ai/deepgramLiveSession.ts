import { createClient, LiveTranscriptionEvents } from "@deepgram/sdk";
import type { ListenLiveClient } from "@deepgram/sdk";

/**
 * Serverless caveat: session state below (the `sessions` map, the open
 * WebSocket client, and its keepAlive interval) lives in module memory and is
 * scoped to a single process/instance. On serverless platforms (e.g. Vercel
 * lambdas) separate invocations of this route may land on different
 * instances, so a `sessionId` minted by one invocation is not guaranteed to
 * resolve on a later one — the connection and any in-progress transcript can
 * simply vanish. This module is only durable on a long-running server
 * process. Callers on serverless should treat live-session failures as
 * expected and fall back to the batch `/api/transcribe` endpoint.
 */

const LISTEN_MODEL = process.env.DEEPGRAM_LISTEN_MODEL ?? "nova-2";
const SESSION_TTL_MS = 5 * 60 * 1000;

type SessionRecord = {
  client: ListenLiveClient;
  committed: string;
  interim: string;
  ready: Promise<void>;
  expiresAt: number;
  keepAlive: ReturnType<typeof setInterval> | null;
  expiryTimer: ReturnType<typeof setTimeout> | null;
};

const sessions = new Map<string, SessionRecord>();

function sweepSessions() {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (session.expiresAt <= now) {
      teardown(session);
      sessions.delete(id);
    }
  }
}

function teardown(session: SessionRecord) {
  if (session.keepAlive) clearInterval(session.keepAlive);
  if (session.expiryTimer) clearTimeout(session.expiryTimer);
  try {
    session.client.requestClose();
  } catch {
    // already closed
  }
}

function createSession(apiKey: string): SessionRecord {
  const dg = createClient(apiKey);
  const client = dg.listen.live({
    model: LISTEN_MODEL,
    smart_format: true,
    interim_results: true,
    // Faster end-of-speech finals for hold-to-talk.
    utterance_end_ms: 1000,
    endpointing: 300,
    vad_events: true,
  });

  const record: SessionRecord = {
    client,
    committed: "",
    interim: "",
    ready: new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("live session open timeout")), 5000);
      client.on(LiveTranscriptionEvents.Open, () => {
        clearTimeout(timeout);
        resolve();
      });
      client.on(LiveTranscriptionEvents.Error, (err) => {
        clearTimeout(timeout);
        reject(err instanceof Error ? err : new Error("live session error"));
      });
    }),
    expiresAt: Date.now() + SESSION_TTL_MS,
    keepAlive: null,
    expiryTimer: null,
  };

  client.on(LiveTranscriptionEvents.Transcript, (data) => {
    const text = data.channel?.alternatives?.[0]?.transcript?.trim() ?? "";
    if (!text) return;
    if (data.is_final || data.speech_final) {
      record.committed = record.committed ? `${record.committed} ${text}` : text;
      record.interim = "";
    } else {
      record.interim = text;
    }
  });

  record.ready
    .then(() => {
      record.keepAlive = setInterval(() => {
        try {
          client.keepAlive();
        } catch {
          // ignore
        }
      }, 8000);
    })
    .catch(() => {});

  return record;
}

function combinedText(session: SessionRecord): string {
  if (session.interim) {
    return (session.committed ? `${session.committed} ${session.interim}` : session.interim).trim();
  }
  return session.committed.trim();
}

export async function startLiveSession(apiKey: string): Promise<string> {
  sweepSessions();
  const id = crypto.randomUUID();
  const session = createSession(apiKey);
  sessions.set(id, session);
  // Self-expiry: tear down an abandoned (warmed-but-never-finished) session
  // on its own instead of relying solely on the next startLiveSession sweep.
  const reap = () => {
    const cur = sessions.get(id);
    if (!cur) return;
    const remaining = cur.expiresAt - Date.now();
    if (remaining > 0) {
      // Session still active (expiresAt slid forward); check again later.
      cur.expiryTimer = setTimeout(reap, remaining + 1000);
    } else {
      teardown(cur);
      sessions.delete(id);
    }
  };
  session.expiryTimer = setTimeout(reap, SESSION_TTL_MS + 1000);
  await session.ready;
  return id;
}

export async function sendLiveAudio(sessionId: string, chunk: Buffer): Promise<{ text: string }> {
  const session = sessions.get(sessionId);
  if (!session) throw new Error("session not found");
  session.expiresAt = Date.now() + SESSION_TTL_MS;
  await session.ready;
  // Deepgram's send() wants ArrayBuffer/Blob; copy the Buffer into a fresh
  // Uint8Array so .buffer is a concrete ArrayBuffer of exactly these bytes.
  session.client.send(new Uint8Array(chunk).buffer);
  return { text: combinedText(session) };
}

export async function finishLiveSession(sessionId: string): Promise<{ text: string }> {
  const session = sessions.get(sessionId);
  if (!session) throw new Error("session not found");
  try {
    session.client.finalize();
  } catch {
    // ignore
  }
  // Allow Deepgram to flush the last finals before we tear down.
  await new Promise((r) => setTimeout(r, 450));
  const text = combinedText(session);
  teardown(session);
  sessions.delete(sessionId);
  return { text };
}

/** @visible-for-testing */
export function clearLiveSessionsForTests() {
  for (const session of sessions.values()) teardown(session);
  sessions.clear();
}
