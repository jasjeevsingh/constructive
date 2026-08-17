"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@deepgram/sdk";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CoachBubble } from "@/components/CoachBubble";
import { useHelperContext } from "@/components/helper/HelperContextProvider";
import { initialHelperState, type HelperPhase, type HelperState } from "@/lib/helper/agentMachine";
import { createAgentSession, type AgentSocket } from "@/lib/helper/agentSession";
import { createAudioQueue } from "@/lib/helper/audioQueue";

const PHASE_LABEL: Partial<Record<HelperPhase, string>> = {
  connecting: "Connecting…",
  listening: "Listening…",
  thinking: "Thinking…",
  speaking: "Speaking…",
};

// Live audio is billed per minute; if the conversation goes quiet this long
// we close the socket rather than let it idle on the meter.
const IDLE_TIMEOUT_MS = 90_000;
// Deepgram closes the agent socket if it hears nothing for 8s.
const KEEP_ALIVE_MS = 5_000;

/** Pure presentation — no sockets, no AudioContext, no fetch. This is what
 *  tests drive directly. */
export function HelperPanelView({
  state,
  open,
  onOpen,
  onClose,
}: {
  state: HelperState;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  if (!open) {
    return (
      <div className="fixed bottom-4 right-4 z-40">
        <Button onClick={onOpen}>🎙 Talk it through</Button>
      </div>
    );
  }

  // The idle guard closes the session but leaves the panel open so a
  // one-tap "Resume" (reusing the same onOpen wiring) can reconnect.
  if (state.phase === "idle") {
    return (
      <div className="fixed inset-x-0 bottom-0 z-40 sm:inset-x-auto sm:bottom-4 sm:right-4 sm:w-96">
        <Card className="border-border">
          <CardContent className="flex flex-col items-start gap-2 p-4">
            <p className="text-xs text-muted-foreground">Paused to save time on the call.</p>
            <div className="flex gap-2">
              <Button size="sm" onClick={onOpen}>
                Resume
              </Button>
              <Button variant="outline" size="sm" onClick={onClose}>
                Close
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 sm:inset-x-auto sm:bottom-4 sm:right-4 sm:w-96">
      <Card className="border-border">
        <CardContent className="flex max-h-[70vh] flex-col gap-3 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{PHASE_LABEL[state.phase] ?? ""}</span>
            <Button variant="outline" size="sm" onClick={onClose}>
              Stop
            </Button>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto">
            {state.turns.map((t, i) =>
              t.role === "helper" ? (
                <CoachBubble key={i}>{t.text}</CoachBubble>
              ) : (
                <p key={i} className="text-sm text-muted-foreground">
                  {t.text}
                </p>
              )
            )}
          </div>
          {state.error && <p className="text-xs text-muted-foreground">{state.error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}

type Mic = {
  stream: MediaStream;
  audioContext: AudioContext;
  processor: ScriptProcessorNode;
};

/** Live wiring: the untestable seam. Real WebSocket, real AudioContext, real
 *  microphone capture. Not covered by unit tests — see task report. */
export function HelperPanel() {
  const ctx = useHelperContext();
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  const [open, setOpen] = useState(false);
  const [state, setState] = useState<HelperState>(initialHelperState());

  const sessionRef = useRef<ReturnType<typeof createAgentSession> | null>(null);
  const keepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const micRef = useRef<Mic | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const turnCountRef = useRef(0);

  const resetIdleTimer = () => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      // Cost guard: stop the session but leave the panel open for a resume tap.
      teardownLive();
    }, IDLE_TIMEOUT_MS);
  };

  const teardownMic = () => {
    const mic = micRef.current;
    if (!mic) return;
    mic.processor.onaudioprocess = null;
    mic.processor.disconnect();
    mic.stream.getTracks().forEach((track) => track.stop());
    void mic.audioContext.close();
    micRef.current = null;
  };

  /** Tears down the socket, mic, and timers, but leaves `open` alone. Used
   *  both by the idle guard (panel stays open, showing Resume) and as the
   *  first half of a full close. */
  const teardownLive = () => {
    if (keepAliveRef.current) {
      clearInterval(keepAliveRef.current);
      keepAliveRef.current = null;
    }
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    teardownMic();
    if (outputAudioContextRef.current) {
      void outputAudioContextRef.current.close();
      outputAudioContextRef.current = null;
    }
    sessionRef.current?.stop();
    sessionRef.current = null;
    turnCountRef.current = 0;
  };

  const connect = async () => {
    const outputAudioContext = new AudioContext();
    outputAudioContextRef.current = outputAudioContext;

    const session = createAgentSession({
      fetchToken: async () => {
        const res = await fetch("/api/deepgram/token", { method: "POST" });
        if (!res.ok) throw new Error("no token");
        return (await res.json()).access_token as string;
      },
      createSocket: (token) => createClient(token).agent() as unknown as AgentSocket,
      createQueue: () => createAudioQueue(outputAudioContext),
      onState: (next) => {
        setState(next);
        if (next.turns.length > turnCountRef.current) {
          turnCountRef.current = next.turns.length;
          resetIdleTimer();
        }
      },
    });
    sessionRef.current = session;
    await session.start(ctxRef.current);

    keepAliveRef.current = setInterval(() => session.keepAlive(), KEEP_ALIVE_MS);
    resetIdleTimer();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      const audioContext = new AudioContext({ sampleRate: 16000 });
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processor.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0);
        const int16 = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
          const sample = Math.max(-1, Math.min(1, input[i]));
          int16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
        }
        session.send(int16.buffer);
      };
      source.connect(processor);
      processor.connect(audioContext.destination);
      micRef.current = { stream, audioContext, processor };
    } catch {
      // Mic permission denied or unavailable. The agent socket is still up
      // (it may still speak); we just can't hear the student.
    }
  };

  const handleOpen = () => {
    // Defensive: by construction there's never a live session here (the
    // initial open has none yet, and Resume only renders after the idle
    // guard's teardownLive() already ran) — this is a no-op guard, not a
    // behavior change.
    teardownLive();
    setOpen(true);
    void connect();
  };

  const handleClose = () => {
    teardownLive();
    setOpen(false);
    setState(initialHelperState());
  };

  useEffect(() => {
    sessionRef.current?.updateContext(ctx);
  }, [ctx]);

  // Full teardown on unmount, regardless of open/closed state.
  useEffect(() => teardownLive, []);

  return <HelperPanelView state={state} open={open} onOpen={handleOpen} onClose={handleClose} />;
}
