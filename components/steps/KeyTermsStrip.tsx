"use client";
import { useState } from "react";
import { VoiceOrTextInput } from "@/components/VoiceOrTextInput";
import { Button } from "@/components/ui/button";
import { CoachBubble } from "@/components/CoachBubble";
import type { Keyword, CoachResponse } from "@/lib/schemas";

/**
 * Optional key-terms prompt above the Claim stage. Replaces the mandatory
 * "Read the motion" stage: it only renders when the motion has a term worth
 * defining (a keyword with a hint), and nothing here blocks the student.
 */
export function KeyTermsStrip({ motion, keywords }: { motion: string; keywords: Keyword[] }) {
  const terms = keywords.filter((k) => k.hint);
  const [active, setActive] = useState<Keyword | null>(null);
  const [reaction, setReaction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (terms.length === 0) return null;

  function pick(k: Keyword) {
    setReaction(null);
    setError(null);
    setActive((cur) => (cur?.word === k.word ? null : k));
  }

  async function submit(answer: string) {
    if (!active) return;
    setError(null);
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          step: "keyword",
          motion,
          payload: { word: active.word, hint: active.hint, answer },
        }),
      });
      if (!res.ok) throw new Error("coach failed");
      const data: CoachResponse = await res.json();
      if (data.kind === "keyword") setReaction(data.reaction);
    } catch {
      setError("The coach is unavailable right now — you can keep going.");
    }
  }

  return (
    <div data-testid="key-terms-strip" className="mb-4 rounded-lg border border-border bg-muted/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Any key terms to define first?</span>
        {terms.map((k) => (
          <Button
            key={k.word}
            type="button"
            size="sm"
            variant={active?.word === k.word ? "default" : "outline"}
            className="h-7 px-2.5"
            aria-pressed={active?.word === k.word}
            onClick={() => pick(k)}
          >
            {k.word}
          </Button>
        ))}
        <span className="text-xs text-muted-foreground">(optional)</span>
      </div>
      {active && (
        <div className="mt-3">
          <p className="text-sm text-muted-foreground">Hint: {active.hint}</p>
          <div className="mt-2">
            <VoiceOrTextInput label={`What does "${active.word}" mean in this debate?`} onSubmit={submit} />
          </div>
          {reaction && <CoachBubble className="mt-3">{reaction}</CoachBubble>}
          {error && <p className="mt-2 text-sm text-muted-foreground">{error}</p>}
        </div>
      )}
    </div>
  );
}
