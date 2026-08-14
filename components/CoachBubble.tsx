import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function CoachBubble({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start gap-2 rounded-lg bg-muted p-3 text-sm text-foreground", className)}>
      <span aria-hidden className="text-base leading-none">💬</span>
      <div className="flex-1">{children}</div>
    </div>
  );
}
