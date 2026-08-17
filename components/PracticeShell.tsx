"use client";
import { useEffect, useState } from "react";
import { getFlowMotions } from "@/lib/flowMotions";
import { drawItem, type PracticePart, type PracticeItem } from "@/lib/practice";
import { loadPracticeCounts, incrementPracticeCount } from "@/lib/state/practiceProgress";
import { ClaimStage } from "@/components/stages/ClaimStage";
import { ImpactStage } from "@/components/stages/ImpactStage";
import { LinkCard } from "@/components/LinkCard";
import { AppShell } from "@/components/ui/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const TITLES: Record<PracticePart, string> = {
  claim: "Practice: Claims",
  link: "Practice: the Link",
  impact: "Practice: Impacts",
};

export function PracticeShell({ part, onExit }: { part: PracticePart; onExit: () => void }) {
  const [item, setItem] = useState<PracticeItem>(() => drawItem(part, getFlowMotions()));
  const [done, setDone] = useState(false);
  const [count, setCount] = useState(0);

  useEffect(() => {
    setCount(loadPracticeCounts(window.localStorage)[part]);
  }, [part]);

  function finishRep() {
    setCount(incrementPracticeCount(window.localStorage, part)[part]);
    setDone(true);
  }

  function nextRep() {
    setItem(drawItem(part, getFlowMotions()));
    setDone(false);
  }

  const drilledMotion = item.part === "link" ? null : item.motion;

  return (
    <AppShell>
      <Card className="flex min-h-[70vh] flex-col overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4 sm:p-5">
          <div>
            <Button variant="ghost" size="sm" onClick={onExit} className="mb-1 h-8 px-2 text-muted-foreground">
              ← Practice
            </Button>
            <div className="font-display text-lg font-semibold leading-snug text-foreground sm:text-xl">
              {TITLES[part]}
            </div>
            {drilledMotion && (
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">{drilledMotion}</p>
            )}
          </div>
          <Badge variant="secondary" className="shrink-0">{count} done</Badge>
        </div>

        <div className="flex-1 p-5 sm:p-6">
          {done ? (
            <div className="mx-auto max-w-md py-8 text-center">
              <div className="text-xs font-semibold uppercase tracking-wide text-primary">Nice rep!</div>
              <p className="mt-2 font-display text-xl font-semibold text-foreground">One more?</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Button onClick={nextRep}>Next rep →</Button>
                <Button variant="ghost" onClick={onExit}>← Back</Button>
              </div>
            </div>
          ) : item.part === "claim" ? (
            <ClaimStage motion={item.motion} side={item.side} claims={item.claims} onComplete={finishRep} />
          ) : item.part === "link" ? (
            <LinkCard scenario={item.scenario} onComplete={finishRep} />
          ) : (
            <ImpactStage
              motion={item.motion}
              claim={item.claim}
              authoredImpact={item.authoredImpact}
              onComplete={finishRep}
            />
          )}
        </div>
      </Card>
    </AppShell>
  );
}
