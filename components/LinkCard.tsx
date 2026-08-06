"use client";
import { useState } from "react";
import { gradeBridge, type BridgeGrade } from "@/lib/linkGrade";
import { useLinkProgress } from "@/lib/state/useLinkProgress";
import { speakCoach } from "@/lib/voice/playSpeech";
import type { LinkScenario, LinkCandidate, CoachResponse } from "@/lib/schemas";

export function LinkCard({ scenario, onExit }: { scenario: LinkScenario; onExit: () => void }) {
  const [progress, update] = useLinkProgress(scenario.id);
  const placed = progress.placedIds;
  const [grade, setGrade] = useState<BridgeGrade | null>(null);
  const [reactions, setReactions] = useState<Record<string, string>>({});
  const [coachError, setCoachError] = useState<Record<string, boolean>>({});

  const placedSet = new Set(placed);

  function toggle(id: string) {
    setGrade(null); // re-sorting invalidates the last test
    const next = placed.includes(id) ? placed.filter((x) => x !== id) : [...placed, id];
    update({ placedIds: next });
  }

  function test() {
    const g = gradeBridge(scenario, placed);
    setGrade(g);
    update({ held: g.held });
  }

  async function talkThrough(c: LinkCandidate) {
    setCoachError((e) => ({ ...e, [c.id]: false }));
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          step: "link",
          motion: scenario.claim,
          payload: { impact: scenario.impact, candidateText: c.text, verdict: c.verdict },
        }),
      });
      if (!res.ok) throw new Error("coach failed");
      const data: CoachResponse = await res.json();
      if (data.kind === "link") {
        setReactions((r) => ({ ...r, [c.id]: data.reaction }));
        void speakCoach(data.reaction);
      }
    } catch {
      setCoachError((e) => ({ ...e, [c.id]: true }));
    }
  }

  function statusOf(id: string) {
    return grade?.perPlank.find((p) => p.id === id)?.status;
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", background: "var(--navy)", border: "1px solid #22324c", borderRadius: 18, padding: 24, color: "var(--text)" }}>
      <button type="button" onClick={onExit} style={{ marginBottom: 12 }}>← activities</button>

      <div style={{ display: "flex", gap: 12, alignItems: "stretch", margin: "6px 0 16px" }}>
        <div style={{ flex: 1, background: "var(--navy-light)", border: "1px solid #2a4a7a", borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: "var(--dim)" }}>Claim</div>
          <div className="serif">{scenario.claim}</div>
        </div>
        <div style={{ flex: 1, background: "rgba(200,150,46,.16)", border: "1px solid var(--gold)", borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: "var(--gold)" }}>Impact</div>
          <div className="serif">{scenario.impact}</div>
        </div>
      </div>

      <div style={{ fontSize: 12, color: "var(--dim)", marginBottom: 8 }}>
        Build the bridge: choose the planks that connect the claim to the impact. Good bridges use
        <span style={{ color: "var(--gold)" }}> evidence</span> and <span style={{ color: "var(--orange)" }}>reasoning</span> together.
      </div>

      {scenario.candidates.map((c) => {
        const isPlaced = placedSet.has(c.id);
        const status = statusOf(c.id);
        const matColor = c.material === "evidence" ? "var(--gold)" : "var(--orange-light)";
        return (
          <div key={c.id} style={{ background: "var(--navy-mid)", border: `1px solid ${status === "wrong" ? "var(--orange)" : status === "correct" ? "#3fae6b" : "#24344f"}`, borderRadius: 10, padding: 10, marginBottom: 9 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ fontSize: 9, letterSpacing: 0.5, textTransform: "uppercase", color: matColor, marginTop: 3, whiteSpace: "nowrap" }}>{c.material}</span>
              <div style={{ flex: 1, fontSize: 14, lineHeight: 1.4 }}>{c.text}</div>
              <button
                type="button"
                aria-label={`${isPlaced ? "Set aside" : "Build"} ${c.text}`}
                onClick={() => toggle(c.id)}
              >
                {isPlaced ? "Set aside" : "Build"}
              </button>
            </div>
            {grade && status !== "correct-omit" && (
              <div style={{ marginTop: 8, fontSize: 13, color: status === "correct" ? "#4fd08a" : "var(--orange-light)" }}>
                {status === "correct" && "✓ Holds — good plank."}
                {status === "missing" && "This one actually fits — you left it out."}
                {status === "wrong" && (c.verdict === "great-but-wrong" ? "🪤 Great but wrong — " : "Doesn't fit — ") + c.explanation}
                {status === "missing" && ` ${c.explanation}`}
                <div style={{ marginTop: 6 }}>
                  <button type="button" onClick={() => talkThrough(c)}>💬 Talk this through</button>
                  {coachError[c.id] && <span style={{ color: "var(--orange-light)", marginLeft: 8 }}>Coach unavailable — keep going.</span>}
                </div>
                {reactions[c.id] && <p style={{ color: "var(--orange-light)", marginTop: 6 }}>💬 {reactions[c.id]}</p>}
              </div>
            )}
          </div>
        );
      })}

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 12 }}>
        <button type="button" onClick={test}>Test the bridge</button>
        {grade && (grade.held
          ? <span style={{ color: "#4fd08a", fontWeight: 700 }}>✓ The bridge holds!</span>
          : <span style={{ color: "var(--orange-light)" }}>
              Not yet{!(grade.hasEvidence && grade.hasReasoning) ? " — a strong bridge needs both evidence and reasoning." : " — check the flagged planks."}
            </span>)}
      </div>
    </div>
  );
}
