"use client";
import { useRef, useState } from "react";
import { VoiceOrTextInput } from "@/components/VoiceOrTextInput";
import { Button } from "@/components/ui/button";
import { StageHeader } from "@/components/stages/StageHeader";
import { CoachBubble } from "@/components/CoachBubble";
import { usePublishHelperContext } from "@/components/helper/HelperContextProvider";
import { CLAIM_TURN_CAP } from "@/lib/claimRubric";
import type { CoachResponse, CoachTurn } from "@/lib/schemas";

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
  const [turns, setTurns] = useState<CoachTurn[]>([]);
  const [mappedId, setMappedId] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [sending, setSending] = useState(false);
  const [lastStudentClaim, setLastStudentClaim] = useState<string | null>(null);
  const sendingRef = useRef(false);

  const attempt = turns.filter((t) => t.role === "student").length;

  usePublishHelperContext({ claimDraft: lastStudentClaim || null, transcript: turns });

  async function submit(text: string) {
    if (!text.trim() || done || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setFallback(false);
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          step: "claim",
          motion,
          payload: { side, studentClaim: text, authoredClaims: claims },
          history: turns,
        }),
      });
      if (!res.ok) throw new Error("coach failed");
      const data: CoachResponse = await res.json();
      if (data.kind !== "claim") {
        setFallback(true);
        return;
      }

      const coachText = [data.reaction, data.question].filter(Boolean).join(" ");
      const nextTurns: CoachTurn[] = [
        ...turns,
        { role: "student", text },
        { role: "coach", text: coachText },
      ];
      setTurns(nextTurns);
      setMappedId(data.mappedClaimId);
      setLastStudentClaim(text);

      const studentTurns = nextTurns.filter((t) => t.role === "student").length;
      setDone(data.verdict === "good-enough" || studentTurns >= CLAIM_TURN_CAP);
    } catch {
      setFallback(true);
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  const mapped = claims.find((c) => c.id === mappedId);

  return (
    <div>
      <StageHeader
        eyebrow="Stage 2 · Claim"
        prompt={`What's your strongest claim ${side === "for" ? "for" : "against"} this motion?`}
      />

      {turns.length > 0 && (
        <div className="mb-4 space-y-3">
          {turns.map((t, i) =>
            t.role === "student" ? (
              <p key={i} className="text-sm text-muted-foreground">
                You said: {t.text}
              </p>
            ) : (
              <CoachBubble key={i}>{t.text}</CoachBubble>
            )
          )}
        </div>
      )}

      {!done && (
        <VoiceOrTextInput
          key={attempt}
          label={attempt === 0 ? "Say or type your claim" : "Answer the coach, or sharpen your claim"}
          onSubmit={submit}
        />
      )}

      {!done && sending && <p className="mt-2 text-sm text-muted-foreground">Thinking…</p>}

      {done && mapped && (
        <div className="mt-3">
          {lastStudentClaim && (
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Your claim
              </div>
              <p className="mt-0.5 font-medium text-foreground">{lastStudentClaim}</p>
            </div>
          )}
          <div className="mt-3 rounded-lg border border-evidence bg-evidence/10 p-3">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Closest authored claim we&apos;ll build the bridge from
            </div>
            <p className="mt-0.5 font-medium text-foreground">{mapped.claim}</p>
          </div>
          <Button type="button" className="mt-3" onClick={() => onComplete(mapped.id)}>
            Build the link →
          </Button>
        </div>
      )}

      {done && !mapped && !fallback && (
        <div className="mt-3">
          <p className="text-sm text-muted-foreground">
            Good work — pick the claim closest to yours to carry forward:
          </p>
          <div className="mt-2 flex flex-col gap-2">
            {claims.map((c) => (
              <Button
                key={c.id}
                type="button"
                variant="outline"
                className="h-auto w-full justify-start whitespace-normal py-2 text-left"
                onClick={() => onComplete(c.id)}
              >
                {c.claim}
              </Button>
            ))}
          </div>
        </div>
      )}

      {fallback && (
        <div className="mt-3">
          <p className="text-sm text-muted-foreground">Coach unavailable — pick the claim closest to yours:</p>
          <div className="mt-2 flex flex-col gap-2">
            {claims.map((c) => (
              <Button
                key={c.id}
                type="button"
                variant="outline"
                className="h-auto w-full justify-start whitespace-normal py-2 text-left"
                onClick={() => onComplete(c.id)}
              >
                {c.claim}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
