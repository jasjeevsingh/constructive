"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { pickRecorderMimeType } from "@/lib/voice/deepgramLive";
import { speakCoach } from "@/lib/voice/playSpeech";
import type { AvatarSession } from "@/lib/avatar/types";
import { getModeConfig } from "@/lib/avatar/cohortAdapter";

type BarStatus = "idle" | "listening" | "transcribing" | "avatar-speaking";

function voiceSupported(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
}

export function AvatarVoiceBar({
  session,
  onStudentTurn,
  disabled = false,
}: {
  session: AvatarSession;
  onStudentTurn: (text: string) => void;
  disabled?: boolean;
}) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<BarStatus>("idle");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [timerSec, setTimerSec] = useState<number | null>(null);

  const config = getModeConfig(session.mode, session.cohort);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const sessionIdRef = useRef<string | null>(null);
  const holdingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function startTimer() {
    let remaining = config.turnDurationSec;
    setTimerSec(remaining);
    timerRef.current = setInterval(() => {
      remaining -= 1;
      setTimerSec(remaining);
      if (remaining <= 0) stopListening();
    }, 1000);
  }

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setTimerSec(null);
  }

  async function startListening() {
    if (holdingRef.current || disabled || status !== "idle") return;
    holdingRef.current = true;
    setVoiceError(null);
    chunksRef.current = [];

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch {
      holdingRef.current = false;
      setVoiceError("Microphone access blocked — type your answer instead.");
      return;
    }
    if (!holdingRef.current) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    streamRef.current = stream;

    const startRes = await fetch("/api/transcribe/live?action=start", { method: "POST" }).catch(() => null);
    if (startRes?.ok) {
      const { sessionId } = await startRes.json();
      sessionIdRef.current = sessionId ?? null;
    }

    const mimeType = pickRecorderMimeType();
    const rec = new MediaRecorder(stream, { mimeType });
    recorderRef.current = rec;
    rec.ondataavailable = (e) => {
      if (e.data.size <= 0) return;
      chunksRef.current.push(e.data);
      const sid = sessionIdRef.current;
      if (sid) {
        void fetch(`/api/transcribe/live?sessionId=${encodeURIComponent(sid)}`, {
          method: "POST",
          headers: { "content-type": e.data.type || "audio/webm" },
          body: e.data,
        }).then(async (res) => {
          if (!res.ok) return;
          const { text: liveText } = await res.json();
          if (liveText) setText(liveText);
        }).catch(() => {});
      }
    };
    rec.start(150);
    setStatus("listening");
    startTimer();
  }

  async function stopListening() {
    if (!holdingRef.current) return;
    holdingRef.current = false;
    stopTimer();
    setStatus("transcribing");

    const rec = recorderRef.current;
    const stream = streamRef.current;
    recorderRef.current = null;
    streamRef.current = null;

    await new Promise<void>((resolve) => {
      if (!rec || rec.state === "inactive") { resolve(); return; }
      rec.onstop = () => resolve();
      rec.stop();
    });
    stream?.getTracks().forEach((t) => t.stop());

    let finalText = text.trim();
    const sid = sessionIdRef.current;
    sessionIdRef.current = null;
    if (sid) {
      try {
        const res = await fetch(`/api/transcribe/live?action=stop&sessionId=${encodeURIComponent(sid)}`, { method: "POST" });
        if (res.ok) {
          const { text: live } = await res.json();
          if (live?.trim()) finalText = live.trim();
        }
      } catch {}
    }

    if (!finalText && chunksRef.current.length > 0) {
      try {
        const blob = new Blob(chunksRef.current, { type: pickRecorderMimeType() });
        const res = await fetch("/api/transcribe", { method: "POST", headers: { "content-type": blob.type }, body: blob });
        if (res.ok) {
          const { text: t } = await res.json();
          if (t?.trim()) finalText = t.trim();
        }
      } catch {}
    }

    if (finalText) {
      setText("");
      setStatus("idle");
      onStudentTurn(finalText);
    } else {
      setVoiceError("Didn't catch that — hold the mic and speak again.");
      setStatus("idle");
    }
  }

  function handleTextSubmit() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setText("");
    onStudentTurn(trimmed);
  }

  const micDisabled = disabled || status === "transcribing" || status === "avatar-speaking";

  return (
    <div className="border-t border-border pt-3">
      {timerSec !== null && (
        <div className="mb-2 text-center text-xs text-muted-foreground">
          {Math.floor(timerSec / 60)}:{String(timerSec % 60).padStart(2, "0")}
        </div>
      )}
      <div className="flex items-center gap-2.5">
        {voiceSupported() && (
          <Button
            type="button"
            variant="secondary"
            disabled={micDisabled}
            aria-pressed={status === "listening"}
            onPointerDown={(e) => {
              e.preventDefault();
              (e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId);
              void startListening();
            }}
            onPointerUp={() => void stopListening()}
            onPointerCancel={() => { if (holdingRef.current) void stopListening(); }}
            style={{ touchAction: "none" }}
          >
            🎤 {status === "listening" ? "Listening…" : status === "transcribing" ? "Transcribing…" : "Hold to speak"}
          </Button>
        )}
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleTextSubmit(); }}
          placeholder="or type your response…"
          disabled={disabled || status === "avatar-speaking"}
          className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
        />
        <Button type="button" disabled={!text.trim() || disabled} onClick={handleTextSubmit}>
          Send
        </Button>
      </div>
      {voiceError && <p className="mt-2 text-sm text-muted-foreground">{voiceError}</p>}
    </div>
  );
}
