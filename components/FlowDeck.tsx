"use client";
import { useEffect, useState } from "react";
import { getFlowMotions } from "@/lib/flowMotions";
import { FlowShell } from "@/components/FlowShell";
import { AppShell } from "@/components/ui/app-shell";
import { Landing } from "@/components/Landing";
import { Badge } from "@/components/ui/badge";
import {
  loadAllFlowProgress,
  motionStatus,
  type MotionStatus,
  type FlowProgress,
} from "@/lib/state/flowProgress";

const STATUS_META: Record<
  MotionStatus,
  { label: string; badge: string; variant: "secondary" | "default" | "success"; cta: string }
> = {
  "not-started": { label: "Not started", badge: "New", variant: "secondary", cta: "Start" },
  "in-progress": { label: "In progress", badge: "In progress", variant: "default", cta: "Resume" },
  "for-done": { label: "FOR side done", badge: "FOR done", variant: "default", cta: "Resume" },
  complete: { label: "Both sides done", badge: "✓ Both sides", variant: "success", cta: "Review" },
};

export function FlowDeck() {
  const motions = getFlowMotions();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [progress, setProgress] = useState<Record<string, FlowProgress>>({});

  useEffect(() => {
    setProgress(loadAllFlowProgress(window.localStorage));
  }, []);

  const active = motions.find((m) => m.id === activeId);
  if (active) return <FlowShell motion={active} onExit={() => setActiveId(null)} />;

  return (
    <AppShell>
      <Landing />
      <section className="mt-12">
        <h2 className="font-display text-2xl font-semibold text-foreground">Pick a motion</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {motions.map((m) => {
            const status = motionStatus(progress[m.id]);
            const meta = STATUS_META[status];
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setActiveId(m.id)}
                aria-label={`${m.motion} — ${meta.label}`}
                data-complete={status === "complete"}
                className="group flex flex-col rounded-lg border border-border bg-card p-5 text-left shadow-sm transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[complete=true]:ring-1 data-[complete=true]:ring-success"
              >
                <Badge variant={meta.variant} className="self-start">
                  {meta.badge}
                </Badge>
                <div className="mt-3 font-display text-lg font-semibold leading-snug text-foreground">
                  {m.motion}
                </div>
                <div className="mt-auto pt-4 text-sm font-semibold text-primary">{meta.cta} →</div>
              </button>
            );
          })}
        </div>
      </section>
    </AppShell>
  );
}
