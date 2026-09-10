"use client";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Pressable } from "@/components/ui/motion";
import { loadPracticeCounts, type PracticeCounts } from "@/lib/state/practiceProgress";
import type { PracticePart } from "@/lib/practice";

const CARDS: { part: PracticePart; title: string; blurb: string }[] = [
  { part: "claim", title: "Practice Claims", blurb: "Make an argument in favor of your side." },
  { part: "link", title: "Practice the Link", blurb: "Build the bridge from claim to impact with evidence + reasoning." },
  { part: "impact", title: "Practice Impacts", blurb: "Why your argument matters beyond the debate." },
];

export function PracticeDeck({ onPick }: { onPick: (part: PracticePart) => void }) {
  const [counts, setCounts] = useState<PracticeCounts>({ claim: 0, link: 0, impact: 0 });

  useEffect(() => {
    setCounts(loadPracticeCounts(window.localStorage));
  }, []);

  return (
    <section className="mt-12">
      <div className="text-xs font-semibold uppercase tracking-wide text-primary">Step 2 · Guided reps</div>
      <h2 className="mt-1 font-display text-2xl font-semibold text-foreground">Practice a skill</h2>
      <p className="mt-1 text-sm text-muted-foreground">Drill one part of the framework with quick reps.</p>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {CARDS.map((c, i) => (
          <Pressable
            key={c.part}
            index={i}
            type="button"
            onClick={() => onPick(c.part)}
            aria-label={`${c.title} — ${counts[c.part]} done`}
            className="group flex flex-col rounded-lg border border-border bg-card p-5 text-left shadow-sm transition-[border-color,box-shadow] hover:border-primary hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Badge variant="secondary" className="self-start">{counts[c.part]} done</Badge>
            <div className="mt-3 font-display text-lg font-semibold leading-snug text-foreground">{c.title}</div>
            <div className="mt-2 text-sm text-muted-foreground">{c.blurb}</div>
            <div className="mt-auto pt-4 text-sm font-semibold text-primary">Start drilling →</div>
          </Pressable>
        ))}
      </div>
    </section>
  );
}
