"use client";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { StageHeader } from "@/components/stages/StageHeader";
import { CoachBubble } from "@/components/CoachBubble";
import { orderChoices, strongChoice, verdictLabel } from "@/lib/choices";
import type { CoachResponse } from "@/lib/schemas";
import { cn } from "@/lib/utils";

type Choice = { id: string; text: string; verdict: string; explanation: string };

/**
 * Pick-the-best-of-four for Claim and Impact (the chess-app ramp: choose
 * before you generate). A wrong pick explains itself and lets the student try
 * again; the right pick explains why and unlocks the next stage.
 */
export function ChoiceStage({
  part,
  eyebrow,
  prompt,
  motion,
  side,
  claim = null,
  choices,
  seed,
  context,
  continueLabel,
  onComplete,
}: {
  part: "claim" | "impact";
  eyebrow: string;
  prompt: string;
  motion: string;
  side: "for" | "against";
  /** The claim the impact must follow from (impact part only). */
  claim?: string | null;
  choices: Choice[];
  /** Stable key used to rotate the option order. */
  seed: string;
  /** Rendered above the options (e.g. the claim box on the impact stage). */
  context?: ReactNode;
  continueLabel: string;
  onComplete: (chosen: Choice) => void;
}) {
  const ordered = orderChoices(choices, seed);
  const best = strongChoice(choices);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [locked, setLocked] = useState<Choice | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [reaction, setReaction] = useState<string | null>(null);
  const [coachError, setCoachError] = useState(false);
  const [asking, setAsking] = useState(false);

  const correct = locked?.verdict === "strong";

  function lockIn() {
    const chosen = ordered.find((c) => c.id === selectedId);
    if (!chosen) return;
    setLocked(chosen);
    setAttempts((n) => n + 1);
    setReaction(null);
    setCoachError(false);
  }

  function tryAgain() {
    setLocked(null);
    setSelectedId(null);
    setReaction(null);
    setCoachError(false);
  }

  async function talkThrough() {
    if (!locked) return;
    setAsking(true);
    setCoachError(false);
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          step: "choice",
          motion,
          payload: {
            side,
            part,
            claim,
            chosen: locked.text,
            verdictLabel: verdictLabel(part, locked.verdict),
            explanation: locked.explanation,
            best: best.text,
          },
        }),
      });
      if (!res.ok) throw new Error("coach failed");
      const data: CoachResponse = await res.json();
      if (data.kind === "choice") setReaction(data.reaction);
      else setCoachError(true);
    } catch {
      setCoachError(true);
    } finally {
      setAsking(false);
    }
  }

  return (
    <div>
      <StageHeader eyebrow={eyebrow} prompt={prompt} />
      {context}
      <p className="mb-3 text-sm text-muted-foreground">
        Pick the strongest one. {attempts > 0 && !correct && "Not that one — try again."}
      </p>

      <div role="radiogroup" aria-label={prompt} className="flex flex-col gap-2">
        {ordered.map((c) => {
          const selected = selectedId === c.id;
          const isLocked = locked?.id === c.id;
          const state = isLocked ? (correct ? "right" : "wrong") : null;
          return (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={correct || (locked !== null && !correct && !isLocked)}
              data-testid="choice-option"
              data-state={state ?? undefined}
              onClick={() => {
                if (locked) return;
                setSelectedId(c.id);
              }}
              className={cn(
                "w-full rounded-lg border bg-card p-3 text-left text-sm leading-snug text-foreground transition-[border-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected && !locked && "border-primary ring-1 ring-primary",
                !selected && !locked && "border-border hover:border-primary/60",
                state === "right" && "border-success bg-success/5 ring-1 ring-success",
                state === "wrong" && "border-destructive bg-destructive/5 ring-1 ring-destructive",
                locked && !isLocked && "opacity-50"
              )}
            >
              {c.text}
            </button>
          );
        })}
      </div>

      {!locked && (
        <Button type="button" className="mt-3" disabled={!selectedId} onClick={lockIn}>
          Lock it in
        </Button>
      )}

      {locked && (
        <div className="mt-3" data-testid="choice-feedback">
          <div
            className={cn(
              "text-xs font-semibold uppercase tracking-wide",
              correct ? "text-success" : "text-destructive"
            )}
          >
            {correct ? "✓ " : "✗ "}
            {verdictLabel(part, locked.verdict)}
          </div>
          <CoachBubble className="mt-2">{locked.explanation}</CoachBubble>
          {reaction && <CoachBubble className="mt-2">{reaction}</CoachBubble>}
          {coachError && (
            <p className="mt-2 text-sm text-muted-foreground">Coach unavailable — keep going.</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {correct ? (
              <Button type="button" onClick={() => onComplete(locked)}>
                {continueLabel}
              </Button>
            ) : (
              <Button type="button" onClick={tryAgain}>
                Try again
              </Button>
            )}
            {!correct && !reaction && (
              <Button type="button" variant="ghost" onClick={talkThrough} disabled={asking}>
                💬 {asking ? "Thinking…" : "Talk this through"}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
