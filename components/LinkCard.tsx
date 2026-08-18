"use client";
import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { gradeBridge, type BridgeGrade } from "@/lib/linkGrade";
import { transitions } from "@/lib/motion";
import { useLinkProgress } from "@/lib/state/useLinkProgress";
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
  const [attempts, setAttempts] = useState(0);
  const [reactions, setReactions] = useState<Record<string, string>>({});
  const [coachError, setCoachError] = useState<Record<string, boolean>>({});
  const shuffleSeed = scenario.id.split("").reduce((n, ch) => n + ch.charCodeAt(0), 0);

  // Fire the celebration once per transition into "held", not on every re-render
  // while it stays held (planks re-toggling or a coach reaction arriving both
  // re-render this component without changing whether the bridge holds).
  const [celebrationId, setCelebrationId] = useState(0);
  const wasHeldRef = useRef(false);
  useEffect(() => {
    const held = !!grade?.held;
    if (held && !wasHeldRef.current) {
      setCelebrationId((n) => n + 1);
    }
    wasHeldRef.current = held;
  }, [grade?.held]);

  function toggle(id: string) {
    setGrade(null); // re-sorting invalidates the last test
    const next = placed.includes(id) ? placed.filter((x) => x !== id) : [...placed, id];
    update({ placedIds: next });
  }

  function test() {
    const g = gradeBridge(scenario, placed);
    setGrade(g);
    setAttempts((n) => (g.held ? 0 : n + 1));
    update({ held: g.held });
  }

  function summary(g: BridgeGrade): string {
    if (g.held) return "✓ The bridge holds!";

    const wrong = g.perPlank.filter((p) => p.status === "wrong");
    const missing = g.perPlank.filter((p) => p.status === "missing");
    const textFor = (id: string) => scenario.candidates.find((c) => c.id === id)?.text ?? "";
    const shorten = (s: string) => (s.length > 48 ? `${s.slice(0, 48).trimEnd()}…` : s);

    const problems: string[] = [];
    if (!g.hasEvidence) problems.push("it has no evidence holding it up");
    if (!g.hasReasoning) problems.push("nothing explains why the evidence matters — that's the reasoning");
    for (const p of wrong) problems.push(`"${shorten(textFor(p.id))}" doesn't carry the weight`);
    for (const p of missing) problems.push(`you left out "${shorten(textFor(p.id))}"`);

    // `attempts` is already incremented (1-based) by the time this render sees
    // it, since setAttempts and setGrade are batched from the same test() call.
    // Index off attempts - 1 so the very first failure leads with the primary
    // problem instead of skipping straight to the second one.
    const round = attempts - 1;
    const openers =
      attempts >= 2
        ? ["Still not holding —", "Close. The gap is that", "Nearly — but"]
        : ["Not yet —", "That span won't hold —", "Almost —"];
    const opener = openers[round % openers.length];
    return `${opener} ${problems[round % Math.max(problems.length, 1)] ?? "check the flagged planks"}.`;
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
        shuffleSeed={shuffleSeed}
      />

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button type="button" onClick={test}>
          Test the bridge
        </Button>
        {grade && (
          <span
            data-testid="bridge-summary"
            className={grade.held ? "font-semibold text-success" : "text-reasoning"}
          >
            {summary(grade)}
          </span>
        )}
        {grade?.held && (
          <motion.span
            key={celebrationId}
            data-testid="bridge-celebration"
            aria-hidden="true"
            className="inline-block text-lg leading-none"
            initial={{ opacity: 0, scale: 0.3, rotate: -12 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={transitions.spring}
          >
            🎉
          </motion.span>
        )}
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
