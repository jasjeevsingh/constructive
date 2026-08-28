"use client";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { AvatarTurn, InlineScore } from "@/lib/avatar/types";

export function TranscriptPane({
  transcript,
  inlineScores,
}: {
  transcript: AvatarTurn[];
  inlineScores: InlineScore[];
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript.length]);

  if (transcript.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center py-12 text-sm text-muted-foreground">
        Start speaking to begin the debate.
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-3 overflow-y-auto py-4">
      {transcript.map((turn, i) => {
        const isStudent = turn.speaker === "student";
        const badge = inlineScores.find((s) => s.turnIndex === i);
        return (
          <div key={i}>
            <div
              className={cn(
                "rounded-lg px-4 py-3",
                isStudent ? "bg-emerald-50 dark:bg-emerald-950/30" : "bg-blue-50 dark:bg-blue-950/30",
              )}
            >
              <div className="text-xs font-semibold text-muted-foreground">
                {isStudent ? "You" : "Avatar"}
              </div>
              <p className="mt-1 text-sm text-foreground">{turn.text}</p>
            </div>
            {badge && (
              <div className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                {badge.criterion} {badge.score}/3
              </div>
            )}
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
