"use client";
import { useState } from "react";
import { VoiceOrTextInput } from "@/components/VoiceOrTextInput";
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
      <div style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: "var(--gold)" }}>Stage 2 · Claim</div>
      <p style={{ fontSize: 17, color: "#fff", margin: "6px 0 14px" }}>
        What&apos;s your strongest claim {side === "for" ? "for" : "against"} this motion?
      </p>
      <VoiceOrTextInput label="Say or type your claim" onSubmit={submit} />

      {reaction && mapped && (
        <div style={{ marginTop: 12 }}>
          <p style={{ color: "var(--orange-light)" }}>💬 {reaction}</p>
          <p style={{ color: "var(--dim)", fontSize: 13 }}>
            We&apos;ll carry this forward as: <b style={{ color: "var(--gold)" }}>{mapped.claim}</b>
          </p>
          <button type="button" onClick={() => onComplete(mapped.id)} style={{ marginTop: 8 }}>
            Build the link →
          </button>
        </div>
      )}

      {fallback && (
        <div style={{ marginTop: 12 }}>
          <p style={{ color: "var(--orange-light)", fontSize: 13 }}>Coach unavailable — pick the claim closest to yours:</p>
          {claims.map((c) => (
            <button key={c.id} type="button" onClick={() => onComplete(c.id)} style={{ display: "block", textAlign: "left", margin: "6px 0", width: "100%" }}>
              {c.claim}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
