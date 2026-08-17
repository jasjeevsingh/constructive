"use client";
import { useCallback, useEffect, useState } from "react";
import {
  emptyFlowProgress, loadFlowProgress, saveFlowProgress, type FlowProgress,
} from "@/lib/state/flowProgress";
import type { Side } from "@/lib/state/flowMachine";

export function useFlowProgress(
  motionId: string,
  startSide: Side = "for"
): [FlowProgress, (patch: Partial<FlowProgress>) => void] {
  const [progress, setProgress] = useState<FlowProgress>(() => emptyFlowProgress(startSide));

  useEffect(() => {
    setProgress(loadFlowProgress(window.localStorage, motionId, startSide));
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

  return [progress, update];
}
