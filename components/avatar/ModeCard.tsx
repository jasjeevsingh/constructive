"use client";
import { cn } from "@/lib/utils";
import { Pressable } from "@/components/ui/motion";

interface ModeCardProps {
  title: string;
  description: string;
  index: number;
  onClick: () => void;
}

export function ModeCard({ title, description, index, onClick }: ModeCardProps) {
  return (
    <Pressable
      index={index}
      type="button"
      onClick={onClick}
      aria-label={title}
      className={cn(
        "flex flex-col rounded-lg border border-border bg-card p-5 text-left shadow-sm",
        "transition-[border-color,box-shadow] hover:border-primary hover:shadow-md",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      )}
    >
      <div className="font-display text-lg font-semibold text-foreground">{title}</div>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      <div className="mt-auto pt-4 text-sm font-semibold text-primary">Start →</div>
    </Pressable>
  );
}
