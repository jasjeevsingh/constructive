"use client";
import { STAGES, stageIndex, type FlowStage } from "@/lib/state/flowMachine";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const LABELS: Record<FlowStage, string> = {
  read: "Read the motion",
  claim: "Claim",
  link: "Link",
  impact: "Impact",
};

type StepState = "done" | "current" | "upcoming";

function dotClasses(state: StepState): string {
  return cn(
    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold",
    state === "done" && "border-success bg-success text-success-foreground",
    state === "current" && "border-primary text-primary",
    state === "upcoming" && "border-border text-muted-foreground"
  );
}

export function FlowRail({ stage }: { stage: FlowStage }) {
  const cur = stageIndex(stage);
  const pct = (cur / (STAGES.length - 1)) * 100;
  const stateOf = (i: number): StepState => (i < cur ? "done" : i === cur ? "current" : "upcoming");

  return (
    <>
      {/* Desktop: vertical sidebar */}
      <nav aria-label="Your progress" className="hidden w-56 shrink-0 border-r border-border p-5 md:block">
        <div className="mb-2 text-xs font-medium text-muted-foreground">Your progress</div>
        <Progress value={pct} className="mb-4" />
        <ol className="space-y-3">
          {STAGES.map((s, i) => {
            const state = stateOf(i);
            return (
              <li key={s} className="flex items-center gap-3">
                <span className={dotClasses(state)}>{state === "done" ? "✓" : i + 1}</span>
                <span
                  className={cn(
                    "text-sm",
                    state === "current" ? "font-semibold text-foreground" : state === "done" ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {LABELS[s]}
                </span>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Mobile: horizontal stepper */}
      <nav aria-label="Your progress" className="border-b border-border p-4 md:hidden">
        <Progress value={pct} className="mb-3" />
        <ol className="flex items-start justify-between gap-2">
          {STAGES.map((s, i) => {
            const state = stateOf(i);
            return (
              <li key={s} className="flex min-w-0 flex-1 flex-col items-center gap-1 text-center">
                <span className={dotClasses(state)}>{state === "done" ? "✓" : i + 1}</span>
                <span className={cn("truncate text-[10px]", state === "current" ? "font-semibold text-foreground" : "text-muted-foreground")}>
                  {LABELS[s]}
                </span>
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
