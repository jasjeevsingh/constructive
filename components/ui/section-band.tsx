import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type BandTone = "paper" | "sky" | "sand" | "gold" | "navy";

/** Full-width color blocks for the home page. Each step gets its own tint so
 *  the page reads as a sequence of rooms rather than one wall of text. */
const TONES: Record<BandTone, { band: string; eyebrow: string; title: string; blurb: string }> = {
  paper: { band: "bg-background", eyebrow: "text-primary", title: "text-foreground", blurb: "text-muted-foreground" },
  sky: { band: "bg-[#E3EBF7]", eyebrow: "text-primary", title: "text-foreground", blurb: "text-muted-foreground" },
  sand: { band: "bg-muted", eyebrow: "text-primary", title: "text-foreground", blurb: "text-muted-foreground" },
  gold: { band: "bg-[#F3E6C6]", eyebrow: "text-[#7A5A12]", title: "text-foreground", blurb: "text-muted-foreground" },
  navy: { band: "bg-[var(--navy)]", eyebrow: "text-[var(--gold)]", title: "text-[var(--text)]", blurb: "text-[var(--dim)]" },
};

export function SectionBand({
  tone,
  eyebrow,
  title,
  blurb,
  id,
  children,
  className,
}: {
  tone: BandTone;
  eyebrow?: string;
  title?: string;
  blurb?: ReactNode;
  id?: string;
  children: ReactNode;
  className?: string;
}) {
  const t = TONES[tone];
  return (
    <section id={id} data-tone={tone} className={cn(t.band, className)}>
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-14">
        {eyebrow && <div className={cn("text-xs font-semibold uppercase tracking-wide", t.eyebrow)}>{eyebrow}</div>}
        {title && <h2 className={cn("mt-1 font-display text-2xl font-semibold sm:text-3xl", t.title)}>{title}</h2>}
        {blurb && <p className={cn("mt-2 max-w-2xl text-sm sm:text-base", t.blurb)}>{blurb}</p>}
        {children}
      </div>
    </section>
  );
}
