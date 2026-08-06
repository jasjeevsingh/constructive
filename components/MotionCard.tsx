"use client";
import { useMotionProgress } from "@/lib/state/useMotionProgress";
import { nextStep, STEPS, stepIndex } from "@/lib/state/cardMachine";
import { RestateStep } from "@/components/steps/RestateStep";
import { KeywordStep } from "@/components/steps/KeywordStep";
import { ArgumentsStep } from "@/components/steps/ArgumentsStep";
import type { Motion } from "@/lib/schemas";

export function MotionCard({ motion, onExit }: { motion: Motion; onExit: () => void }) {
  const [progress, update] = useMotionProgress(motion.id);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", background: "var(--navy)", border: "1px solid #22324c", borderRadius: 18, padding: 24 }}>
      <button type="button" onClick={onExit} style={{ marginBottom: 12 }}>← deck</button>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {STEPS.map((s, i) => (
          <div key={s} className="accent" style={{ flex: 1, textAlign: "center", color: i === stepIndex(progress.step) ? "var(--gold)" : "var(--dim)", borderBottom: `2px solid ${i === stepIndex(progress.step) ? "var(--gold)" : "#22324c"}`, paddingBottom: 6, fontSize: 12 }}>
            {i + 1}
          </div>
        ))}
      </div>
      <h2 className="serif" style={{ borderBottom: "1px solid #22324c", paddingBottom: 12 }}>{motion.motion}</h2>

      {progress.step === "restate" && (
        <RestateStep
          motion={motion.motion}
          initial={progress.restate}
          onNext={(restate) => update({ restate, step: nextStep("restate") })}
        />
      )}
      {progress.step === "keyword" && (
        <KeywordStep motion={motion} onNext={() => update({ step: nextStep("keyword") })} />
      )}
      {progress.step === "arguments" && (
        <ArgumentsStep
          motion={motion.motion}
          onDone={({ argsFor, argsAgainst }) => update({ argsFor, argsAgainst, completed: true })}
        />
      )}
    </div>
  );
}
