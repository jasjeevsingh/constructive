"use client";
import { useCallback, useEffect, useState } from "react";
import {
  emptyFlowProgress, loadFlowProgress, saveFlowProgress, type FlowProgress,
} from "@/lib/state/flowProgress";
import type { Side } from "@/lib/state/flowMachine";

/**
 * Returns the saved progress for a motion plus an updater, and whether the
 * saved copy has been read yet. Until `hydrated` is true the value is the
 * empty default — callers should hold off rendering a stage, or the student
 * sees the default Claim stage flash before cross-fading to where they were.
 */
export function useFlowProgress(
  motionId: string,
  startSide: Side = "for"
): [FlowProgress, (patch: Partial<FlowProgress>) => void, boolean] {
  const [progress, setProgress] = useState<FlowProgress>(() => emptyFlowProgress(startSide));
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setProgress(loadFlowProgress(window.localStorage, motionId, startSide));
    setHydrated(true);
  }, [motionId, startSide]);

  const update = useCallback(
    (patch: Partial<FlowProgress>) => {
      setProgress((prev) => {
        const next = { ...prev, ...patch };
        saveFlowProgress(window.localStorage, motionId, next);
        return next;
      });
    },
    [motionId]
  );

  return [progress, update, hydrated];
}
