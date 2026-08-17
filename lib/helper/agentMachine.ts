export type HelperPhase = "idle" | "connecting" | "listening" | "thinking" | "speaking" | "error";

export type HelperState = {
  phase: HelperPhase;
  turns: { role: "student" | "helper"; text: string }[];
  error: string | null;
};

export type HelperEvent =
  | { type: "connecting" }
  | { type: "open" }
  | { type: "ready" }
  | { type: "conversationText"; role: string; content: string }
  | { type: "userStartedSpeaking" }
  | { type: "thinking" }
  | { type: "audio" }
  | { type: "audioDone" }
  | { type: "closed" }
  | { type: "error"; message: string };

/** The session performs effects the reducer asks for. Keeping barge-in as an
 *  effect keeps it testable without a socket or an AudioContext. */
export type HelperEffect = "dropAudio" | null;

export function initialHelperState(): HelperState {
  return { phase: "idle", turns: [], error: null };
}

export function reduceHelper(
  state: HelperState,
  event: HelperEvent
): { state: HelperState; effect: HelperEffect } {
  switch (event.type) {
    case "connecting":
      return { state: { ...state, phase: "connecting", error: null }, effect: null };
    case "open":
      return { state: { ...state, phase: "connecting" }, effect: null };
    case "ready":
      return { state: { ...state, phase: "listening", error: null }, effect: null };
    case "conversationText": {
      const role = event.role === "user" ? ("student" as const) : ("helper" as const);
      if (!event.content.trim()) return { state, effect: null };
      return { state: { ...state, turns: [...state.turns, { role, text: event.content }] }, effect: null };
    }
    case "userStartedSpeaking":
      // Deepgram stops generating on its side; dropping our queued audio is our job.
      return { state: { ...state, phase: "listening" }, effect: "dropAudio" };
    case "thinking":
      return { state: { ...state, phase: "thinking" }, effect: null };
    case "audio":
      return { state: { ...state, phase: "speaking" }, effect: null };
    case "audioDone":
      return { state: { ...state, phase: "listening" }, effect: null };
    case "closed":
      return { state: { ...state, phase: "idle" }, effect: null };
    case "error":
      return { state: { ...state, phase: "error", error: event.message }, effect: null };
  }
}
