"use client";
import { useEffect, useState } from "react";
import { CLI_DEFINITIONS, CLI_PARTS, type CliPart } from "@/lib/cli";
import { hasAdvancedAnywhere } from "@/lib/state/flowProgress";
import type { FlowStage } from "@/lib/state/flowMachine";
import { cn } from "@/lib/utils";

export const CHEATSHEET_STORAGE_KEY = "constructive:cheatsheet:v1";

/** A student's explicit open/close choice wins; before they've made one, the
 *  sheet is open until they've advanced past Claim anywhere. */
export function cheatSheetDefaultOpen(storage: Storage): boolean {
  const stored = storage.getItem(CHEATSHEET_STORAGE_KEY);
  if (stored === "open") return true;
  if (stored === "closed") return false;
  return !hasAdvancedAnywhere(storage);
}

const PART_TONE: Record<CliPart, string> = {
  claim: "bg-foreground",
  link: "bg-evidence",
  impact: "bg-success",
};

function MiniBridge({ current }: { current: FlowStage }) {
  const lit = (p: CliPart) => (p === current ? "opacity-100" : "opacity-35");
  return (
    <div aria-hidden className="mt-2 flex h-8 items-end gap-0.5">
      <div className={cn("h-6 w-1/4 rounded-tl-md bg-foreground", lit("claim"))} />
      <div className="flex h-full w-1/2 flex-col justify-end">
        <div className={cn("h-1.5 rounded-sm bg-reasoning", lit("link"))} />
        <div className={cn("mt-0.5 h-2 rounded-sm bg-evidence", lit("link"))} />
      </div>
      <div className={cn("h-5 w-1/4 rounded-tr-md bg-success", lit("impact"))} />
    </div>
  );
}

export function CliCheatSheet({ stage, className }: { stage: FlowStage; className?: string }) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    setOpen(cheatSheetDefaultOpen(window.localStorage));
  }, []);

  function toggle() {
    setOpen((o) => {
      const next = !o;
      window.localStorage.setItem(CHEATSHEET_STORAGE_KEY, next ? "open" : "closed");
      return next;
    });
  }

  return (
    <section data-testid="cli-cheatsheet" className={cn("rounded-lg border border-border bg-muted/30", className)}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
      >
        <span>Quick reference</span>
        <span aria-hidden>{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="px-3 pb-3">
          <MiniBridge current={stage} />
          <dl className="mt-2 space-y-2">
            {CLI_PARTS.map((part) => {
              const d = CLI_DEFINITIONS[part];
              const current = part === stage;
              return (
                <div
                  key={part}
                  data-testid={current ? "cheatsheet-current" : undefined}
                  className={cn("rounded-md border-l-2 pl-2", current ? "border-primary" : "border-transparent")}
                >
                  <dt className="flex items-center gap-1.5 text-xs">
                    <span className={cn("h-2 w-2 rounded-full", PART_TONE[part])} aria-hidden />
                    <span className={cn("font-semibold", current ? "text-foreground" : "text-muted-foreground")}>
                      {d.label}
                    </span>
                    <span className="text-muted-foreground">{d.tag}</span>
                  </dt>
                  <dd className={cn("mt-0.5 text-xs leading-snug", current ? "text-foreground" : "text-muted-foreground")}>
                    {d.definition}
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>
      )}
    </section>
  );
}
