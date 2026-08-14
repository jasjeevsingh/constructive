"use client";
import { useState } from "react";
import { gradeBridge, type BridgeGrade } from "@/lib/linkGrade";
import { useLinkProgress } from "@/lib/state/useLinkProgress";
import { speakCoach } from "@/lib/voice/playSpeech";
import type { LinkScenario, LinkCandidate, CoachResponse } from "@/lib/schemas";
import { StageHeader } from "@/components/stages/StageHeader";
import { Bridge } from "@/components/stages/Bridge";
import { Button } from "@/components/ui/button";

export function LinkCard({
  scenario,
  onComplete,
}: {
  scenario: LinkScenario;
  onExit?: () => void;
  onComplete?: () => void;
}) {
  const [progress, update] = useLinkProgress(scenario.id);
  const placed = progress.placedIds;
  const [grade, setGrade] = useState<BridgeGrade | null>(null);
  const [reactions, setReactions] = useState<Record<string, string>>({});
  const [coachError, setCoachError] = useState<Record<string, boolean>>({});

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

  return (
    <div>
      <StageHeader eyebrow="Stage 3 · Link" />
      <p className="mb-4 text-sm text-muted-foreground">
        Build the bridge: choose the planks that connect the claim to the impact. Strong bridges use{" "}
        <span className="font-medium text-evidence">evidence</span> and{" "}
        <span className="font-medium text-reasoning">reasoning</span> together.
      </p>

      <Bridge
        claim={scenario.claim}
        impact={scenario.impact}
        candidates={scenario.candidates}
        placedIds={placed}
        grade={grade}
        reactions={reactions}
        coachError={coachError}
        onToggle={toggle}
        onTalkThrough={talkThrough}
      />

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button type="button" onClick={test}>
          Test the bridge
        </Button>
        {grade &&
          (grade.held ? (
            <span className="font-semibold text-success">✓ The bridge holds!</span>
          ) : (
            <span className="text-reasoning">
              Not yet
              {!(grade.hasEvidence && grade.hasReasoning)
                ? " — a strong bridge needs both evidence and reasoning."
                : " — check the flagged planks."}
            </span>
          ))}
      </div>

      {onComplete && grade?.held && (
        <div className="mt-3">
          <Button type="button" variant="secondary" onClick={onComplete}>
            Continue →
          </Button>
        </div>
      )}
    </div>
  );
}
