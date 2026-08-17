"use client";
import { useEffect, useState } from "react";
import { getFlowMotions } from "@/lib/flowMotions";
import { FlowShell } from "@/components/FlowShell";
import { AppShell } from "@/components/ui/app-shell";
import { Landing } from "@/components/Landing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UniverseGenerator } from "@/components/UniverseGenerator";
import { PracticeDeck } from "@/components/PracticeDeck";
import { PracticeShell } from "@/components/PracticeShell";
import type { PracticePart } from "@/lib/practice";
import type { FlowMotion } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { Pressable } from "@/components/ui/motion";
import type { Side } from "@/lib/state/flowMachine";
import {
  loadAllFlowProgress,
  motionStatus,
  hasFlowProgress,
  type MotionStatus,
  type FlowProgress,
} from "@/lib/state/flowProgress";

const STATUS_META: Record<
  MotionStatus,
  { label: string; badge: string; variant: "secondary" | "default" | "success"; cta: string }
> = {
  "not-started": { label: "Not started", badge: "New", variant: "secondary", cta: "Start" },
  "in-progress": { label: "In progress", badge: "In progress", variant: "default", cta: "Resume" },
  "one-side-done": { label: "One side done", badge: "1 side done", variant: "default", cta: "Resume" },
  complete: { label: "Both sides done", badge: "✓ Both sides", variant: "success", cta: "Review" },
};

type Opened = { motion: FlowMotion; side: Side };

export function FlowDeck() {
  const motions = getFlowMotions();
  const [active, setActive] = useState<Opened | null>(null);
  const [choosing, setChoosing] = useState<FlowMotion | null>(null);
  const [practicePart, setPracticePart] = useState<PracticePart | null>(null);
  const [progress, setProgress] = useState<Record<string, FlowProgress>>({});

  useEffect(() => {
    setProgress(loadAllFlowProgress(window.localStorage));
  }, []);

  /** Resume in place if the motion is already started; otherwise ask which side first. */
  function open(m: FlowMotion) {
    if (hasFlowProgress(window.localStorage, m.id)) {
      setActive({ motion: m, side: "for" }); // ignored — saved progress wins
      return;
    }
    setChoosing(m);
  }

  if (active) {
    return (
      <FlowShell
        motion={active.motion}
        startSide={active.side}
        onExit={() => {
          // Progress was written to localStorage during the journey (e.g. a side just got
          // completed) — re-read it so the deck's badges aren't stale on return.
          setProgress(loadAllFlowProgress(window.localStorage));
          setActive(null);
        }}
      />
    );
  }
  if (practicePart) return <PracticeShell part={practicePart} onExit={() => setPracticePart(null)} />;
  if (choosing) {
    return (
      <AppShell>
        <div className="mx-auto max-w-lg py-10 text-center">
          <div className="text-xs font-semibold uppercase tracking-wide text-primary">
            Pick your starting side
          </div>
          <h2 className="mt-2 font-display text-2xl font-semibold leading-snug text-foreground">
            {choosing.motion}
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Which side do you want to argue first? You&apos;ll argue the other side as Part 2.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button onClick={() => { setActive({ motion: choosing, side: "for" }); setChoosing(null); }}>
              Argue FOR first
            </Button>
            <Button onClick={() => { setActive({ motion: choosing, side: "against" }); setChoosing(null); }}>
              Argue AGAINST first
            </Button>
          </div>
          <Button variant="ghost" className="mt-4 text-muted-foreground" onClick={() => setChoosing(null)}>
            ← back to motions
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Landing />
      <section className="mt-12">
        <h2 className="font-display text-2xl font-semibold text-foreground">Pick a motion</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {motions.map((m, i) => {
            const status = motionStatus(progress[m.id]);
            const meta = STATUS_META[status];
            return (
              <Pressable
                key={m.id}
                index={i}
                type="button"
                onClick={() => open(m)}
                aria-label={`${m.motion} — ${meta.label}`}
                className={cn(
                  "group flex flex-col rounded-lg border border-border bg-card p-5 text-left shadow-sm transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  status === "complete" && "ring-1 ring-success"
                )}
              >
                <Badge variant={meta.variant} className="self-start">
                  {meta.badge}
                </Badge>
                <div className="mt-3 font-display text-lg font-semibold leading-snug text-foreground">
                  {m.motion}
                </div>
                <div className="mt-auto pt-4 text-sm font-semibold text-primary">{meta.cta} →</div>
              </Pressable>
            );
          })}
        </div>
      </section>
      <UniverseGenerator onOpen={(m, side) => setActive({ motion: m, side })} />
      <PracticeDeck onPick={setPracticePart} />
    </AppShell>
  );
}
