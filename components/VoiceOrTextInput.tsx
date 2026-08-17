"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { pickRecorderMimeType } from "@/lib/voice/deepgramLive";

function voiceSupported(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
}

type VoiceStatus = "idle" | "listening" | "transcribing";

export function VoiceOrTextInput({
  label,
  onSubmit,
}: {
  label: string;
  onSubmit: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const sessionIdRef = useRef<string | null>(null);
  const holdingRef = useRef(false);
  const pendingChunksRef = useRef<Blob[]>([]);
  const warmSessionRef = useRef<Promise<string | null> | null>(null);
  const textRef = useRef("");

  useEffect(() => {
    textRef.current = text;
  }, [text]);

  // Warm a live session so the first hold isn't blocked on WebSocket open.
  useEffect(() => {
    if (!voiceSupported()) return;
    warmSessionRef.current = fetch("/api/transcribe/live?action=start", { method: "POST" })
      .then(async (res) => {
        if (!res.ok) return null;
        const { sessionId } = await res.json();
        return (sessionId as string) ?? null;
      })
      .catch(() => null);

    return () => {
      const warm = warmSessionRef.current;
      warmSessionRef.current = null;
      void warm
        ?.then((id) => {
          if (!id || sessionIdRef.current === id) return;
          void fetch(
            `/api/transcribe/live?action=stop&sessionId=${encodeURIComponent(id)}`,
            { method: "POST" }
          ).catch(() => {});
        })
        .catch(() => {});
    };
  }, []);

  async function claimSession(): Promise<string | null> {
    if (sessionIdRef.current) return sessionIdRef.current;
    const warm = warmSessionRef.current;
    warmSessionRef.current = null;
    if (warm) {
      const id = await warm;
      if (id) {
        sessionIdRef.current = id;
        return id;
      }
    }
    const res = await fetch("/api/transcribe/live?action=start", { method: "POST" });
    if (!res.ok) return null;
    const { sessionId } = await res.json();
    sessionIdRef.current = sessionId ?? null;
    return sessionIdRef.current;
  }

  async function transcribeBatch(blob: Blob): Promise<string> {
    const res = await fetch("/api/transcribe", {
      method: "POST",
      headers: { "content-type": blob.type || "audio/webm" },
      body: blob,
    });
    if (!res.ok) throw new Error("batch transcription failed");
    const { text: t } = await res.json();
    return t?.trim() ?? "";
  }

  async function sendLiveChunk(sessionId: string, chunk: Blob) {
    const res = await fetch(`/api/transcribe/live?sessionId=${encodeURIComponent(sessionId)}`, {
      method: "POST",
      headers: { "content-type": chunk.type || "audio/webm" },
      body: chunk,
    });
    if (!res.ok) return;
    const { text: liveText } = await res.json();
    if (liveText) setText(liveText);
  }

  async function flushPending(sessionId: string) {
    const pending = pendingChunksRef.current;
    pendingChunksRef.current = [];
    for (const chunk of pending) {
      await sendLiveChunk(sessionId, chunk);
    }
  }

  async function finishLiveSession(sessionId: string): Promise<string> {
    const res = await fetch(
      `/api/transcribe/live?action=stop&sessionId=${encodeURIComponent(sessionId)}`,
      { method: "POST" }
    );
    if (!res.ok) return "";
    const { text: liveText } = await res.json();
    return liveText?.trim() ?? "";
  }

  async function startListening() {
    if (holdingRef.current || status === "listening" || status === "transcribing") return;
    holdingRef.current = true;
    setVoiceError(null);
    chunksRef.current = [];
    pendingChunksRef.current = [];

    // Mic first — don't wait on network before capturing audio.
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch {
      holdingRef.current = false;
      setVoiceError("Microphone access was blocked — type your answer instead.");
      return;
    }
    if (!holdingRef.current) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    streamRef.current = stream;

    const sessionPromise = claimSession().then(async (id) => {
      if (id) await flushPending(id);
      return id;
    });

    const mimeType = pickRecorderMimeType();
    const rec = new MediaRecorder(stream, { mimeType });
    recorderRef.current = rec;
    rec.ondataavailable = (e) => {
      if (e.data.size <= 0) return;
      chunksRef.current.push(e.data);
      const sessionId = sessionIdRef.current;
      if (sessionId) void sendLiveChunk(sessionId, e.data);
      else pendingChunksRef.current.push(e.data);
    };
    // Smaller timeslice → lower perceived latency for interim text.
    rec.start(150);
    setStatus("listening");
    void sessionPromise;
  }

  async function stopListening() {
    if (!holdingRef.current) return;
    holdingRef.current = false;
    setStatus("transcribing");

    const rec = recorderRef.current;
    const stream = streamRef.current;
    recorderRef.current = null;
    streamRef.current = null;

    await new Promise<void>((resolve) => {
      if (!rec || rec.state === "inactive") {
        resolve();
        return;
      }
      rec.onstop = () => resolve();
      rec.stop();
    });
    stream?.getTracks().forEach((t) => t.stop());

    // Ensure late chunks are attached before finalize.
    let sessionId = sessionIdRef.current;
    if (!sessionId) sessionId = await claimSession();
    if (sessionId) await flushPending(sessionId);
    sessionIdRef.current = null;

    let finalText = textRef.current.trim();
    if (sessionId) {
      try {
        const live = await finishLiveSession(sessionId);
        if (live) finalText = live;
      } catch {
        // fall through to batch
      }
    }

    if (!finalText && chunksRef.current.length > 0) {
      try {
        const blob = new Blob(chunksRef.current, { type: pickRecorderMimeType() });
        finalText = await transcribeBatch(blob);
      } catch {
        setVoiceError("Couldn't transcribe that — try again or type it.");
      }
    }

    // Re-warm a session for the next press.
    warmSessionRef.current = fetch("/api/transcribe/live?action=start", { method: "POST" })
      .then(async (res) => {
        if (!res.ok) return null;
        const { sessionId: id } = await res.json();
        return (id as string) ?? null;
      })
      .catch(() => null);

    if (finalText) {
      setText(finalText);
      setStatus("idle");
      return;
    }

    setVoiceError((prev) => prev ?? "Didn't catch that — hold the mic and speak again.");
    setStatus("idle");
  }

  const micLabel =
    status === "listening"
      ? "Listening… release to finish"
      : status === "transcribing"
        ? "Transcribing…"
        : "Hold to talk";

  return (
    <div>
      <label className="mb-2 block text-sm text-muted-foreground">{label}</label>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        className="w-full rounded-lg border border-input bg-background p-2.5 text-base text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2.5">
        {voiceSupported() && (
          <Button
            type="button"
            variant="secondary"
            disabled={status === "transcribing"}
            aria-pressed={status === "listening"}
            onPointerDown={(e) => {
              e.preventDefault();
              (e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId);
              void startListening();
            }}
            onPointerUp={() => void stopListening()}
            onPointerCancel={() => {
              if (holdingRef.current) void stopListening();
            }}
            style={{ touchAction: "none", opacity: status === "listening" ? 0.85 : 1 }}
          >
            🎤 {micLabel}
          </Button>
        )}
        <Button
          type="button"
          onClick={() => onSubmit(text)}
          disabled={status === "transcribing" || !text.trim()}
        >
          Submit
        </Button>
      </div>
      {voiceError && <p className="mt-2 text-sm text-muted-foreground">{voiceError}</p>}
    </div>
  );
}
