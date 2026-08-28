"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { pickRecorderMimeType } from "@/lib/voice/deepgramLive";
import type { AvatarSession } from "@/lib/avatar/types";
import { getModeConfig } from "@/lib/avatar/cohortAdapter";
import { cn } from "@/lib/utils";

type BarStatus = "idle" | "listening" | "transcribing" | "avatar-speaking";

function voiceSupported(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
}

export function AvatarVoiceBar({
  session,
  onStudentTurn,
  onEnd,
  disabled = false,
  onStatusChange,
}: {
  session: AvatarSession;
  onStudentTurn: (text: string) => void;
  onEnd: () => void;
  disabled?: boolean;
  onStatusChange?: (status: BarStatus) => void;
}) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<BarStatus>("idle");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [timerSec, setTimerSec] = useState<number | null>(null);
  const [showTextInput, setShowTextInput] = useState(false);

  const config = getModeConfig(session.mode, session.cohort);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const sessionIdRef = useRef<string | null>(null);
  const holdingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

  function updateStatus(s: BarStatus) {
    setStatus(s);
    onStatusChange?.(s);
  }

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

  const startListening = useCallback(async () => {
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
      setShowTextInput(true);
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
    updateStatus("listening");
    startTimer();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, status]);

  const stopListening = useCallback(async () => {
    if (!holdingRef.current) return;
    holdingRef.current = false;
    stopTimer();
    updateStatus("transcribing");

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
      updateStatus("idle");
      onStudentTurn(finalText);
    } else {
      setVoiceError("Didn't catch that — try again or type it.");
      updateStatus("idle");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, onStudentTurn]);

  // Spacebar push-to-talk
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code !== "Space") return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;
      if (e.repeat) return;
      e.preventDefault();
      void startListening();
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code !== "Space") return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;
      e.preventDefault();
      void stopListening();
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [startListening, stopListening]);

  function handleTextSubmit() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setText("");
    onStudentTurn(trimmed);
  }

  const micDisabled = disabled || status === "transcribing" || status === "avatar-speaking";
  const timerFraction = timerSec !== null ? timerSec / config.turnDurationSec : 0;
  const circumference = 2 * Math.PI * 34;

  return (
    <div className="flex flex-col items-center gap-3 pb-4">
      {/* Text input (expandable) */}
      {showTextInput && (
        <div className="flex w-full max-w-md items-center gap-2 px-4">
          <input
            ref={textInputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleTextSubmit(); }}
            placeholder="Type your argument…"
            disabled={disabled || status === "avatar-speaking"}
            className="flex-1 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none"
          />
          <button
            type="button"
            disabled={!text.trim() || disabled}
            onClick={handleTextSubmit}
            className="rounded-full bg-white/20 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/30 disabled:opacity-40"
          >
            Send
          </button>
        </div>
      )}

      {/* Call bar */}
      <div className="flex items-center gap-6">
        {/* Keyboard toggle */}
        <button
          type="button"
          onClick={() => {
            setShowTextInput(!showTextInput);
            if (!showTextInput) setTimeout(() => textInputRef.current?.focus(), 50);
          }}
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-full transition-colors",
            showTextInput ? "bg-white/20 text-white" : "bg-white/10 text-white/60 hover:bg-white/20 hover:text-white",
          )}
          aria-label="Toggle text input"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M8 16h8" />
          </svg>
        </button>

        {/* Mic button with timer ring */}
        {voiceSupported() && (
          <div className="relative">
            {/* Timer ring */}
            {timerSec !== null && (
              <svg className="absolute -inset-1 h-[calc(100%+8px)] w-[calc(100%+8px)]" viewBox="0 0 76 76">
                <circle cx="38" cy="38" r="34" fill="none" stroke="white" strokeOpacity="0.1" strokeWidth="3" />
                <circle
                  cx="38" cy="38" r="34" fill="none" stroke="#4ade80" strokeWidth="3"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference * (1 - timerFraction)}
                  strokeLinecap="round"
                  transform="rotate(-90 38 38)"
                  className="transition-[stroke-dashoffset] duration-1000 ease-linear"
                />
              </svg>
            )}
            <button
              type="button"
              disabled={micDisabled}
              onPointerDown={(e) => {
                e.preventDefault();
                (e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId);
                void startListening();
              }}
              onPointerUp={() => void stopListening()}
              onPointerCancel={() => { if (holdingRef.current) void stopListening(); }}
              style={{ touchAction: "none" }}
              className={cn(
                "relative z-10 flex h-16 w-16 items-center justify-center rounded-full transition-all duration-200",
                status === "listening"
                  ? "scale-110 bg-green-500 shadow-[0_0_24px_rgba(74,222,128,0.5)]"
                  : status === "transcribing"
                  ? "bg-amber-500 shadow-[0_0_16px_rgba(251,191,36,0.4)]"
                  : "bg-white/20 hover:bg-white/30",
                micDisabled && status !== "transcribing" && "opacity-40 cursor-not-allowed",
              )}
              aria-label={status === "listening" ? "Release to send" : "Hold to speak"}
            >
              {status === "transcribing" ? (
                <svg className="h-6 w-6 animate-spin text-white" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeLinecap="round" />
                </svg>
              ) : (
                <svg className="h-7 w-7 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                  <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                </svg>
              )}
            </button>
          </div>
        )}

        {/* End call */}
        <button
          type="button"
          onClick={onEnd}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/80 text-white transition-colors hover:bg-red-500"
          aria-label="End debate"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M16.5 2.25 7.5 11.25 16.5 20.25" transform="rotate(90 12 12)" />
            <line x1="4" y1="12" x2="20" y2="12" />
          </svg>
        </button>
      </div>

      {/* Status hint */}
      <div className="text-center text-xs text-white/40">
        {voiceError ? (
          <span className="text-amber-400">{voiceError}</span>
        ) : status === "listening" ? (
          <span className="text-green-400">Listening — release to send</span>
        ) : status === "transcribing" ? (
          <span className="text-amber-400">Processing…</span>
        ) : (
          <span>Hold mic or press <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px]">space</kbd> to talk</span>
        )}
      </div>
    </div>
  );
}
