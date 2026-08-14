import { cn } from "@/lib/utils";

export function StageHeader({
  eyebrow,
  prompt,
  className,
}: {
  eyebrow: string;
  prompt?: string;
  className?: string;
}) {
  return (
    <div className={cn("mb-3", className)}>
      <div className="text-xs font-semibold uppercase tracking-wide text-primary">{eyebrow}</div>
      {prompt && (
        <p className="mt-1 font-display text-lg leading-snug text-foreground sm:text-xl">{prompt}</p>
      )}
    </div>
  );
}
