"use client";
import { useState } from "react";
import { VoiceOrTextInput } from "@/components/VoiceOrTextInput";
import { Button } from "@/components/ui/button";
import { speakCoach } from "@/lib/voice/playSpeech";
import { segmentMotion } from "@/lib/keywordMatch";
import type { Motion, CoachResponse } from "@/lib/schemas";
import { StageHeader } from "@/components/stages/StageHeader";
import { CoachBubble } from "@/components/CoachBubble";

export function KeywordStep({
  motion,
  onNext,
}: {
  motion: Motion;
  onNext: () => void;
}) {
  const [active, setActive] = useState<Motion["keywords"][number] | null>(null);
  const [reaction, setReaction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(answer: string) {
    if (!active) return;
    setError(null);
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          step: "keyword",
          motion: motion.motion,
          payload: { word: active.word, hint: active.hint, answer },
        }),
      });
      if (!res.ok) {
        setError("The coach is unavailable right now — you can keep going.");
        return;
      }
      const data: CoachResponse = await res.json();
      if (data.kind === "keyword") {
        setReaction(data.reaction);
        void speakCoach(data.reaction);
      }
    } catch {
      setError("The coach is unavailable right now — you can keep going.");
    }
  }

  return (
    <div>
      <StageHeader eyebrow="Stage 1 · Read" prompt="Tap a highlighted keyword to pin down what it really means." />
      <p className="font-display text-xl leading-relaxed text-foreground">
        {segmentMotion(motion.motion, motion.keywords).map((segment, i) => {
          if (segment.keyword) {
            const kw = segment.keyword;
            return (
              <span
                key={i}
                onClick={() => {
                  setActive(kw);
                  setReaction(null);
                }}
                className="cursor-pointer rounded border-b-2 border-dashed border-evidence px-0.5 text-evidence hover:bg-evidence/10"
              >
                {segment.text}
              </span>
            );
          }
          return <span key={i}>{segment.text}</span>;
        })}
      </p>
      {active && (
        <div className="mt-3">
          <VoiceOrTextInput label={`What's the scope of "${active.word}" here — and why?`} onSubmit={submit} />
          {active.hint && <p className="mt-2 text-sm text-muted-foreground">Hint: {active.hint}</p>}
          {reaction && <CoachBubble className="mt-3">{reaction}</CoachBubble>}
          {error && <p className="mt-2.5 text-muted-foreground">{error}</p>}
        </div>
      )}
      <Button type="button" className="mt-3.5" onClick={onNext}>
        Next: claim →
      </Button>
    </div>
  );
}
