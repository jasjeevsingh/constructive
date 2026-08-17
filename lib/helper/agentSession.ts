import { helperPrompt } from "@/lib/helper/helperPrompt";
import { initialHelperState, reduceHelper, type HelperEvent, type HelperState } from "@/lib/helper/agentMachine";
import type { HelperContext } from "@/lib/helper/context";

export type AgentSocket = {
  on(event: string, handler: (payload: unknown) => void): void;
  configure(options: unknown): void;
  updatePrompt(prompt: string): void;
  send(data: ArrayBuffer): void;
  keepAlive(): void;
  requestClose(): void;
};

export type AgentQueue = { push(pcm: ArrayBuffer): void; drop(): void; close(): void };

export type SessionDeps = {
  fetchToken: () => Promise<string>;
  createSocket: (token: string) => AgentSocket;
  createQueue: () => AgentQueue;
  onState: (s: HelperState) => void;
};

// Hardcoded, not env-driven: agentConfig runs in the browser, where server-only
// env vars are unreadable. Matches the repo's COACH_MODEL default and the Aura
// voice already used by /api/speak.
const LISTEN_MODEL = "nova-3";
const SPEAK_MODEL = "aura-2-thalia-en";
const THINK_MODEL = "claude-sonnet-5";

export function agentConfig(prompt: string) {
  return {
    audio: {
      input: { encoding: "linear16", sample_rate: 16000 },
      output: { encoding: "linear16", sample_rate: 24000, container: "none" },
    },
    agent: {
      language: { type: "en" },
      listen: { provider: { type: "deepgram", model: LISTEN_MODEL } },
      think: { provider: { type: "anthropic", model: THINK_MODEL }, prompt },
      speak: { provider: { type: "deepgram", model: SPEAK_MODEL } },
    },
  };
}

export function createAgentSession(deps: SessionDeps) {
  let socket: AgentSocket | null = null;
  let queue: AgentQueue | null = null;
  let state = initialHelperState();

  function dispatch(event: HelperEvent) {
    const { state: next, effect } = reduceHelper(state, event);
    state = next;
    if (effect === "dropAudio") queue?.drop();
    deps.onState(state);
  }

  async function start(ctx: HelperContext): Promise<void> {
    dispatch({ type: "connecting" });
    let token: string;
    try {
      token = await deps.fetchToken();
    } catch {
      dispatch({ type: "error", message: "Voice helper is unavailable right now." });
      return;
    }
    try {
      queue = deps.createQueue();
      socket = deps.createSocket(token);
    } catch {
      dispatch({ type: "error", message: "Couldn't start the voice helper." });
      return;
    }

    socket.on("Open", () => dispatch({ type: "open" }));
    socket.on("Welcome", () => dispatch({ type: "ready" }));
    socket.on("SettingsApplied", () => dispatch({ type: "ready" }));
    socket.on("ConversationText", (p) => {
      const t = p as { role?: string; content?: string };
      dispatch({ type: "conversationText", role: t.role ?? "assistant", content: t.content ?? "" });
    });
    socket.on("UserStartedSpeaking", () => dispatch({ type: "userStartedSpeaking" }));
    socket.on("AgentThinking", () => dispatch({ type: "thinking" }));
    socket.on("AgentAudioDone", () => dispatch({ type: "audioDone" }));
    socket.on("Audio", (p) => {
      const buf = p as ArrayBuffer;
      queue?.push(buf);
      dispatch({ type: "audio" });
    });
    socket.on("Close", () => dispatch({ type: "closed" }));
    socket.on("Error", (p) => {
      const e = p as { message?: string };
      dispatch({ type: "error", message: e?.message ?? "The voice helper hit a problem." });
    });

    // configure() MUST precede any audio.
    socket.configure(agentConfig(helperPrompt(ctx)));
  }

  function updateContext(ctx: HelperContext): void {
    socket?.updatePrompt(helperPrompt(ctx));
  }

  function stop(): void {
    socket?.requestClose();
    queue?.close();
    socket = null;
    queue = null;
    dispatch({ type: "closed" });
  }

  return {
    start,
    updateContext,
    stop,
    send: (d: ArrayBuffer) => socket?.send(d),
    keepAlive: () => socket?.keepAlive(),
  };
}
