"use client";
import { useState } from "react";
import { VoiceOrTextInput } from "@/components/VoiceOrTextInput";
import type { CoachResponse } from "@/lib/schemas";

export function ImpactStage({
  motion,
  claim,
  authoredImpact,
  onComplete,
}: {
  motion: string;
  claim: string;
  authoredImpact: string;
  onComplete: (impact: string) => void;
}) {
  const [reaction, setReaction] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [saved, setSaved] = useState("");

  async function submit(text: string) {
    if (!text.trim()) return;
    setSaved(text);
    setError(false);
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ step: "impact", motion, payload: { claim, authoredImpact, studentImpact: text } }),
      });
      if (!res.ok) throw new Error("coach failed");
      const data: CoachResponse = await res.json();
      if (data.kind === "impact") setReaction(data.reaction);
    } catch {
      setError(true);
    }
  }

  return (
    <div>
      <div style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: "var(--gold)" }}>Stage 4 · Impact</div>
      <p style={{ fontSize: 17, color: "#fff", margin: "6px 0 14px" }}>So what? Why does this claim matter — what&apos;s the bigger consequence?</p>
      <VoiceOrTextInput label="Say or type the impact" onSubmit={submit} />
      {reaction && <p style={{ color: "var(--orange-light)", marginTop: 12 }}>💬 {reaction}</p>}
      {error && <p style={{ color: "var(--orange-light)", marginTop: 12 }}>Coach unavailable — keep going.</p>}
      {(reaction || error) && (
        <button type="button" onClick={() => onComplete(saved)} style={{ marginTop: 10 }}>
          Finish this side ✓
        </button>
      )}
    </div>
  );
}
