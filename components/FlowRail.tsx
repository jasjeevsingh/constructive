"use client";
import { STAGES, STAGE_LABELS, stageIndex, type FlowStage } from "@/lib/state/flowMachine";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type StepState = "done" | "current" | "upcoming";

function dotClasses(state: StepState): string {
  return cn(
    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold",
    state === "done" && "border-success bg-success text-success-foreground",
    state === "current" && "border-primary text-primary",
    state === "upcoming" && "border-border text-muted-foreground"
  );
}

export function FlowRail({
  stage,
  onSelect,
}: {
  stage: FlowStage;
  onSelect?: (stage: FlowStage) => void;
}) {
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
              <li key={s}>
                <StepRow state={state} label={STAGE_LABELS[s]} index={i} onSelect={onSelect ? () => onSelect(s) : undefined} />
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
              <li key={s} className="min-w-0 flex-1">
                <StepRow
                  state={state}
                  label={STAGE_LABELS[s]}
                  index={i}
                  onSelect={onSelect ? () => onSelect(s) : undefined}
                  layout="column"
                />
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}

function StepRow({
  state,
  label,
  index,
  onSelect,
  layout = "row",
}: {
  state: StepState;
  label: string;
  index: number;
  onSelect?: () => void;
  layout?: "row" | "column";
}) {
  const labelClasses = cn(
    layout === "column" ? "truncate text-[10px]" : "text-sm",
    state === "current" ? "font-semibold text-foreground" : state === "done" ? "text-foreground" : "text-muted-foreground"
  );
  const content = (
    <>
      <span className={dotClasses(state)}>{state === "done" ? "✓" : index + 1}</span>
      <span className={labelClasses}>{label}</span>
    </>
  );
  const wrapperClasses = cn(
    "w-full items-center gap-3",
    layout === "column" ? "flex flex-col text-center" : "flex"
  );

  // Only a completed stage can be revisited — the current and upcoming stages stay plain.
  if (state === "done" && onSelect) {
    return (
      <button
        type="button"
        onClick={onSelect}
        className={cn(wrapperClasses, "rounded text-left hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")}
      >
        {content}
      </button>
    );
  }
  return <div className={wrapperClasses}>{content}</div>;
}
