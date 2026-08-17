"use client";
import type { LinkCandidate } from "@/lib/schemas";
import type { BridgeGrade, PlankStatus } from "@/lib/linkGrade";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CoachBubble } from "@/components/CoachBubble";
import { cn } from "@/lib/utils";
import { BridgeScene } from "@/components/stages/BridgeScene";

export function Bridge({
  claim,
  impact,
  candidates,
  placedIds,
  grade,
  reactions,
  coachError,
  onToggle,
  onTalkThrough,
}: {
  claim: string;
  impact: string;
  candidates: LinkCandidate[];
  placedIds: string[];
  grade: BridgeGrade | null;
  reactions: Record<string, string>;
  coachError: Record<string, boolean>;
  onToggle: (id: string) => void;
  onTalkThrough: (c: LinkCandidate) => void;
}) {
  const placedSet = new Set(placedIds);
  const placed = candidates.filter((c) => placedSet.has(c.id));
  const unplaced = candidates.filter((c) => !placedSet.has(c.id));
  const statusOf = (id: string): PlankStatus | undefined =>
    grade?.perPlank.find((p) => p.id === id)?.status;
  const held = grade?.held ?? false;
  const testResult: "held" | "failed" | null = grade == null ? null : grade.held ? "held" : "failed";
  const sceneBeams = placed.map((c) => ({ id: c.id, material: c.material }));

  function feedback(c: LinkCandidate) {
    const status = statusOf(c.id);
    if (!grade || !status || status === "correct-omit") return null;
    return (
      <div
        className={cn(
          "mt-2 text-sm",
          status === "correct" ? "text-success" : status === "wrong" ? "text-destructive" : "text-reasoning"
        )}
      >
        {status === "correct" && "✓ Holds — good plank."}
        {status === "missing" && <>This one actually fits — you left it out. {c.explanation}</>}
        {status === "wrong" && (
          <>{(c.verdict === "great-but-wrong" ? "🪤 Great but wrong — " : "Doesn't fit — ") + c.explanation}</>
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => onTalkThrough(c)}>
            💬 Talk this through
          </Button>
          {coachError[c.id] && <span className="text-muted-foreground">Coach unavailable — keep going.</span>}
        </div>
        {reactions[c.id] && <CoachBubble className="mt-2">{reactions[c.id]}</CoachBubble>}
      </div>
    );
  }

  function plankRow(c: LinkCandidate, isPlaced: boolean) {
    const status = statusOf(c.id);
    const stateRing =
      status === "wrong" ? "ring-1 ring-destructive" : status === "correct" ? "ring-1 ring-success" : "";
    return (
      <div key={c.id} className={cn("rounded-lg border border-border bg-card p-3", stateRing)}>
        <div className="flex items-start gap-3">
          <Badge variant={c.material === "evidence" ? "evidence" : "reasoning"} className="mt-0.5 shrink-0 capitalize">
            {c.material}
          </Badge>
          <div className="flex-1 text-sm leading-snug text-foreground">{c.text}</div>
          <Button
            type="button"
            variant={isPlaced ? "secondary" : "default"}
            size="sm"
            aria-label={`${isPlaced ? "Set aside" : "Build"} ${c.text}`}
            onClick={() => onToggle(c.id)}
          >
            {isPlaced ? "Set aside" : "Build"}
          </Button>
        </div>
        {feedback(c)}
      </div>
    );
  }

  return (
    <div>
      <BridgeScene placed={sceneBeams} testResult={testResult} />
      <div className="flex flex-col gap-3 md:flex-row md:items-stretch">
        {/* Claim pier */}
        <div className="rounded-lg border border-border bg-muted/40 p-3 md:w-48 md:shrink-0">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Claim</div>
          <div className="font-display text-sm leading-snug text-foreground">{claim}</div>
        </div>

        {/* Span / deck */}
        <div
          className={cn(
            "flex-1 rounded-lg border-2 border-dashed p-3 transition-colors",
            held ? "border-success bg-success/5" : placed.length ? "border-border" : "border-border bg-muted/20"
          )}
        >
          {placed.length === 0 ? (
            <div className="flex h-full min-h-[64px] items-center justify-center text-center text-sm text-muted-foreground">
              No planks yet — build the span from the materials below.
            </div>
          ) : (
            <div className="space-y-2">{placed.map((c) => plankRow(c, true))}</div>
          )}
        </div>

        {/* Impact pier */}
        <div className="rounded-lg border border-evidence bg-evidence/10 p-3 md:w-48 md:shrink-0">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-evidence">Impact</div>
          <div className="font-display text-sm leading-snug text-foreground">{impact}</div>
        </div>
      </div>

      {/* Materials tray */}
      {unplaced.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Materials</div>
          <div className="space-y-2">{unplaced.map((c) => plankRow(c, false))}</div>
        </div>
      )}
    </div>
  );
}
