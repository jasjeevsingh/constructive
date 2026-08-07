"use client";
import { useState } from "react";
import { VoiceOrTextInput } from "@/components/VoiceOrTextInput";
import { speakCoach } from "@/lib/voice/playSpeech";
import type { CoachResponse } from "@/lib/schemas";

export function RestateStep({
  motion,
  initial,
  onNext,
}: {
  motion: string;
  initial: string;
  onNext: (restate: string) => void;
}) {
  const [reaction, setReaction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(initial);

  async function submit(text: string) {
    setSaved(text);
    setError(null);
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ step: "restate", motion, payload: { restate: text } }),
      });
      if (!res.ok) {
        setError("The coach is unavailable right now — you can keep going.");
        return;
      }
      const data: CoachResponse = await res.json();
      if (data.kind === "restate") {
        setReaction(data.reaction);
        void speakCoach(data.reaction);
      }
    } catch {
      setError("The coach is unavailable right now — you can keep going.");
    }
  }

  return (
    <div>
      <VoiceOrTextInput label="Say the motion in your own words — what's the core claim?" onSubmit={submit} />
      {reaction && <p style={{ color: "var(--orange-light)", marginTop: 10 }}>💬 {reaction}</p>}
      {error && <p style={{ color: "var(--orange-light)", marginTop: 10 }}>{error}</p>}
      {(reaction || error) && (
        <button type="button" style={{ marginTop: 10 }} onClick={() => onNext(saved)}>
          Next: keywords →
        </button>
      )}
    </div>
  );
}
