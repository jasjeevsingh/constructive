import { FALLACIES, isFallacyId } from "@/lib/fallacies";
import { cn } from "@/lib/utils";

function Whistle() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-6 w-6" fill="currentColor">
      <path d="M14.5 6a1.5 1.5 0 1 1 3 0v2.2A6 6 0 1 1 9 20a6 6 0 0 1-5.7-4.1L2 15.2V10h9.5a5.9 5.9 0 0 1 3-1.7V6Zm-5.5 6a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" />
    </svg>
  );
}

/**
 * A referee's penalty card for one logical fallacy. Yellow for most, red for
 * ad hominem. Rendered in CSS so it stays crisp and matches the printed deck.
 * Renders nothing for an unknown id (a coach may hallucinate one).
 */
export function FallacyCard({ id, className }: { id: string; className?: string }) {
  if (!isFallacyId(id)) return null;
  const f = FALLACIES[id];
  const red = f.card === "red";
  return (
    <figure
      data-testid="fallacy-card"
      data-fallacy={f.id}
      role="note"
      aria-label={`${f.name} fallacy card`}
      className={cn(
        "max-w-xs rounded-lg p-2 text-[#1B2A4A] shadow-sm",
        red ? "bg-[#D63030]" : "bg-[#E8C840]",
        className
      )}
    >
      <div className="flex flex-col items-center rounded-md border-2 border-[#1B2A4A] px-4 py-4 text-center">
        <Whistle />
        <div className="mt-2 text-[10px] font-semibold uppercase tracking-[0.2em] opacity-80">
          {red ? "Red card" : "Yellow card"}
        </div>
        <div className="mt-1 font-sans text-2xl font-black uppercase leading-none tracking-tight">{f.name}</div>
        <p className="mt-3 font-display text-sm font-semibold italic leading-snug">{f.definition}</p>
        <figcaption className="mt-3 font-display text-xs italic leading-snug opacity-90">
          &ldquo;{f.example}&rdquo;
        </figcaption>
      </div>
    </figure>
  );
}
