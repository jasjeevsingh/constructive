"use client";
import { useState } from "react";
import { VoiceOrTextInput } from "@/components/VoiceOrTextInput";
import type { Motion, CoachResponse } from "@/lib/schemas";

export function KeywordStep({
  motion,
  onNext,
}: {
  motion: Motion;
  onNext: () => void;
}) {
  const [active, setActive] = useState<Motion["keywords"][number] | null>(null);
  const [reaction, setReaction] = useState<string | null>(null);

  const keywordSet = new Set(motion.keywords.map((k) => k.word.toLowerCase()));

  async function submit(answer: string) {
    if (!active) return;
    const res = await fetch("/api/coach", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        step: "keyword",
        motion: motion.motion,
        payload: { word: active.word, hint: active.hint, answer },
      }),
    });
    const data: CoachResponse = await res.json();
    if (data.kind === "keyword") setReaction(data.reaction);
  }

  return (
    <div>
      <p className="serif" style={{ fontSize: 22 }}>
        {motion.motion.split(/(\s+)/).map((tok, i) => {
          const clean = tok.trim().replace(/[.,]/g, "").toLowerCase();
          const kw = motion.keywords.find((k) => k.word.toLowerCase() === clean);
          if (kw && keywordSet.has(clean)) {
            return (
              <span
                key={i}
                onClick={() => { setActive(kw); setReaction(null); }}
                style={{ cursor: "pointer", color: "var(--gold)", borderBottom: "2px dashed var(--gold)" }}
              >
                {tok}
              </span>
            );
          }
          return <span key={i}>{tok}</span>;
        })}
      </p>
      {active && (
        <div style={{ marginTop: 12 }}>
          <VoiceOrTextInput label={`What's the scope of "${active.word}" here — and why?`} onSubmit={submit} />
          {reaction && <p style={{ color: "var(--orange-light)", marginTop: 10 }}>💬 {reaction}</p>}
        </div>
      )}
      <button type="button" style={{ marginTop: 14 }} onClick={onNext}>
        Next: arguments →
      </button>
    </div>
  );
}
