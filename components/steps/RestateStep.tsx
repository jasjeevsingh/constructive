"use client";
import { useState } from "react";
import { VoiceOrTextInput } from "@/components/VoiceOrTextInput";
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
  const [saved, setSaved] = useState(initial);

  async function submit(text: string) {
    setSaved(text);
    const res = await fetch("/api/coach", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ step: "restate", motion, payload: { restate: text } }),
    });
    const data: CoachResponse = await res.json();
    if (data.kind === "restate") setReaction(data.reaction);
  }

  return (
    <div>
      <VoiceOrTextInput label="Say the motion in your own words — what's the core claim?" onSubmit={submit} />
      {reaction && <p style={{ color: "var(--orange-light)", marginTop: 10 }}>💬 {reaction}</p>}
      {reaction && (
        <button type="button" style={{ marginTop: 10 }} onClick={() => onNext(saved)}>
          Next: keywords →
        </button>
      )}
    </div>
  );
}
