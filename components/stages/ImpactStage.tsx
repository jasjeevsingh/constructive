"use client";
import { useState } from "react";
import { VoiceOrTextInput } from "@/components/VoiceOrTextInput";
import { Button } from "@/components/ui/button";
import { StageHeader } from "@/components/stages/StageHeader";
import { CoachBubble } from "@/components/CoachBubble";
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
      <StageHeader eyebrow="Stage 4 · Impact" prompt="So what? Why does this claim matter — what's the bigger consequence?" />
      <div className="mb-4 rounded-lg border border-evidence bg-evidence/10 p-3">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Your claim
        </div>
        <p className="mt-0.5 font-medium text-foreground">{claim}</p>
      </div>
      <VoiceOrTextInput label="Say or type the impact" onSubmit={submit} />
      {reaction && <CoachBubble className="mt-3">{reaction}</CoachBubble>}
      {error && <p className="mt-3 text-muted-foreground">Coach unavailable — keep going.</p>}
      {(reaction || error) && (
        <Button type="button" className="mt-3" onClick={() => onComplete(saved)}>
          Finish this side ✓
        </Button>
      )}
    </div>
  );
}
