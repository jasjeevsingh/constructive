"use client";
import { useState } from "react";
import { VoiceOrTextInput } from "@/components/VoiceOrTextInput";
import { Button } from "@/components/ui/button";
import type { CoachResponse } from "@/lib/schemas";

export function ClaimStage({
  motion,
  side,
  claims,
  onComplete,
}: {
  motion: string;
  side: "for" | "against";
  claims: { id: string; claim: string }[];
  onComplete: (mappedClaimId: string) => void;
}) {
  const [reaction, setReaction] = useState<string | null>(null);
  const [mappedId, setMappedId] = useState<string | null>(null);
  const [fallback, setFallback] = useState(false);

  async function submit(text: string) {
    if (!text.trim()) return;
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          step: "claim",
          motion,
          payload: { side, studentClaim: text, authoredClaims: claims },
        }),
      });
      if (!res.ok) throw new Error("coach failed");
      const data: CoachResponse = await res.json();
      if (data.kind === "claim") {
        setReaction(data.reaction);
        setMappedId(data.mappedClaimId);
      }
    } catch {
      setFallback(true);
    }
  }

  const mapped = claims.find((c) => c.id === mappedId);

  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-primary">Stage 2 · Claim</div>
      <p className="my-2 text-lg text-foreground">
        What&apos;s your strongest claim {side === "for" ? "for" : "against"} this motion?
      </p>
      <VoiceOrTextInput label="Say or type your claim" onSubmit={submit} />

      {reaction && mapped && (
        <div className="mt-3">
          <p className="text-foreground">💬 {reaction}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            We&apos;ll carry this forward as: <b className="text-evidence">{mapped.claim}</b>
          </p>
          <Button type="button" className="mt-2" onClick={() => onComplete(mapped.id)}>
            Build the link →
          </Button>
        </div>
      )}

      {fallback && (
        <div className="mt-3">
          <p className="text-sm text-muted-foreground">Coach unavailable — pick the claim closest to yours:</p>
          <div className="mt-2 flex flex-col gap-2">
            {claims.map((c) => (
              <Button key={c.id} type="button" variant="outline" className="h-auto w-full justify-start whitespace-normal py-2 text-left" onClick={() => onComplete(c.id)}>
                {c.claim}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
