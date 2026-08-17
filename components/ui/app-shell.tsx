import type { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  // Inlined at build time — must stay a full static expression.
  const feedbackUrl = process.env.NEXT_PUBLIC_FEEDBACK_URL;

  return (
    <div className="min-h-[100dvh]">
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center px-4 py-3 sm:px-6">
          <span className="font-display text-xl font-semibold text-foreground">Constructive</span>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</main>
      {feedbackUrl && (
        <footer className="border-t border-border">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-2 gap-y-1 px-4 py-6 text-xs text-muted-foreground sm:px-6">
            <span>Something off, or an idea to share?</span>
            <a
              href={feedbackUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-medium text-primary"
            >
              User feedback →
            </a>
          </div>
        </footer>
      )}
    </div>
  );
}
