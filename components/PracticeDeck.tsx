"use client";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Pressable } from "@/components/ui/motion";
import { loadPracticeCounts, type PracticeCounts } from "@/lib/state/practiceProgress";
import type { PracticePart } from "@/lib/practice";

const CARDS: { part: PracticePart; title: string; blurb: string; accent: string }[] = [
  { part: "claim", title: "Practice Claims", blurb: "Make an argument in favor of your side.", accent: "border-t-foreground" },
  { part: "link", title: "Practice the Link", blurb: "Build the bridge from claim to impact with evidence + reasoning.", accent: "border-t-evidence" },
  { part: "impact", title: "Practice Impacts", blurb: "Why your argument matters beyond the debate.", accent: "border-t-success" },
];

export function PracticeDeck({ onPick }: { onPick: (part: PracticePart) => void }) {
  const [counts, setCounts] = useState<PracticeCounts>({ claim: 0, link: 0, impact: 0 });

  useEffect(() => {
    setCounts(loadPracticeCounts(window.localStorage));
  }, []);

  return (
    <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {CARDS.map((c, i) => (
          <Pressable
            key={c.part}
            index={i}
            type="button"
            onClick={() => onPick(c.part)}
            aria-label={`${c.title} — ${counts[c.part]} done`}
            className={`group flex flex-col rounded-xl border border-border border-t-4 bg-card p-5 text-left shadow-sm transition-[border-color,box-shadow] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${c.accent}`}
          >
            <Badge variant="secondary" className="self-start">{counts[c.part]} done</Badge>
            <div className="mt-3 font-display text-lg font-semibold leading-snug text-foreground">{c.title}</div>
            <div className="mt-2 text-sm text-muted-foreground">{c.blurb}</div>
            <div className="mt-auto pt-4 text-sm font-semibold text-primary">Start drilling →</div>
          </Pressable>
        ))}
    </div>
  );
}
