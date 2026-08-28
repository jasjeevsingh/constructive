"use client";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { AvatarTurn, InlineScore } from "@/lib/avatar/types";

export function TranscriptDrawer({
  transcript,
  inlineScores,
  open,
  onClose,
}: {
  transcript: AvatarTurn[];
  inlineScores: InlineScore[];
  open: boolean;
  onClose: () => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript.length, open]);

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      )}

      {/* Drawer */}
      <div
        className={cn(
          "fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col bg-gray-900/95 shadow-2xl backdrop-blur transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h3 className="text-sm font-semibold text-white/80">Transcript</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close transcript"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {transcript.length === 0 ? (
            <p className="text-center text-sm text-white/30">No turns yet.</p>
          ) : (
            transcript.map((turn, i) => {
              const isStudent = turn.speaker === "student";
              const badge = inlineScores.find((s) => s.turnIndex === i);
              return (
                <div key={i}>
                  <div
                    className={cn(
                      "rounded-lg px-3 py-2",
                      isStudent ? "bg-emerald-500/15" : "bg-blue-500/15",
                    )}
                  >
                    <div className={cn("text-[10px] font-semibold uppercase tracking-wide", isStudent ? "text-emerald-400/70" : "text-blue-400/70")}>
                      {isStudent ? "You" : "Avatar"}
                    </div>
                    <p className="mt-0.5 text-sm leading-relaxed text-white/90">{turn.text}</p>
                  </div>
                  {badge && (
                    <div className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-white/50">
                      {badge.criterion} {badge.score}/3
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>
      </div>
    </>
  );
}

export function TranscriptPane({
  transcript,
  inlineScores,
}: {
  transcript: AvatarTurn[];
  inlineScores: InlineScore[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Toggle button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs text-white/60 transition-colors hover:bg-white/20 hover:text-white"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        Transcript{transcript.length > 0 && ` (${transcript.length})`}
      </button>

      <TranscriptDrawer
        transcript={transcript}
        inlineScores={inlineScores}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
