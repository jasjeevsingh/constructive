import type { ReactNode } from "react";
import { FeedbackPanel } from "@/components/feedback/FeedbackPanel";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh]">
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center px-4 py-3 sm:px-6">
          <span className="font-display text-xl font-semibold text-foreground">Constructive</span>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</main>
      <FeedbackPanel />
    </div>
  );
}
