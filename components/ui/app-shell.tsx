import type { ReactNode } from "react";
import { FeedbackPanel } from "@/components/feedback/FeedbackPanel";

/**
 * Page chrome. `layout="contained"` (default) centers content in a max-width
 * column; `layout="full"` hands the whole width to the page so it can lay
 * down full-bleed color bands and constrain each one itself.
 */
export function AppShell({ children, layout = "contained" }: { children: ReactNode; layout?: "contained" | "full" }) {
  return (
    <div className="min-h-[100dvh]">
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center px-4 py-3 sm:px-6">
          <span className="font-display text-xl font-semibold text-foreground">Constructive</span>
        </div>
      </header>
      {layout === "full" ? (
        <main>{children}</main>
      ) : (
        <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</main>
      )}
      <FeedbackPanel />
    </div>
  );
}
