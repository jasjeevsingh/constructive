"use client";
import { useState } from "react";
import { VoiceOrTextInput } from "@/components/VoiceOrTextInput";
import { segmentMotion } from "@/lib/keywordMatch";
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
        {segmentMotion(motion.motion, motion.keywords).map((segment, i) => {
          if (segment.keyword) {
            const kw = segment.keyword;
            return (
              <span
                key={i}
                onClick={() => { setActive(kw); setReaction(null); }}
                style={{ cursor: "pointer", color: "var(--gold)", borderBottom: "2px dashed var(--gold)" }}
              >
                {segment.text}
              </span>
            );
          }
          return <span key={i}>{segment.text}</span>;
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
