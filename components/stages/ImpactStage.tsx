"use client";
import { useState } from "react";
import { VoiceOrTextInput } from "@/components/VoiceOrTextInput";
import { Button } from "@/components/ui/button";
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
      <div className="text-xs font-semibold uppercase tracking-wide text-primary">Stage 4 · Impact</div>
      <p className="my-2 text-lg text-foreground">So what? Why does this claim matter — what&apos;s the bigger consequence?</p>
      <VoiceOrTextInput label="Say or type the impact" onSubmit={submit} />
      {reaction && <p className="mt-3 text-foreground">💬 {reaction}</p>}
      {error && <p className="mt-3 text-muted-foreground">Coach unavailable — keep going.</p>}
      {(reaction || error) && (
        <Button type="button" className="mt-3" onClick={() => onComplete(saved)}>
          Finish this side ✓
        </Button>
      )}
    </div>
  );
}
