"use client";
import { useState } from "react";
import { VoiceOrTextInput } from "@/components/VoiceOrTextInput";
import { Button } from "@/components/ui/button";
import type { CoachResponse } from "@/lib/schemas";
import { StageHeader } from "@/components/stages/StageHeader";
import { CoachBubble } from "@/components/CoachBubble";

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
      }
    } catch {
      setError("The coach is unavailable right now — you can keep going.");
    }
  }

  return (
    <div>
      <StageHeader eyebrow="Stage 1 · Read" />
      <figure className="mb-4 border-l-4 border-border pl-3">
        <figcaption className="text-xs font-medium uppercase tracking-wide text-muted-foreground">The motion</figcaption>
        <blockquote className="font-display text-lg leading-snug text-foreground">{motion}</blockquote>
      </figure>
      <VoiceOrTextInput label="Say the motion in your own words — what's the core claim?" onSubmit={submit} />
      {reaction && <CoachBubble className="mt-3">{reaction}</CoachBubble>}
      {error && <p className="mt-2.5 text-muted-foreground">{error}</p>}
      {(reaction || error) && (
        <Button type="button" className="mt-3" onClick={() => onNext(saved)}>
          Next: keywords →
        </Button>
      )}
    </div>
  );
}
