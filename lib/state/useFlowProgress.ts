"use client";
import { useCallback, useEffect, useState } from "react";
import {
  emptyFlowProgress, loadFlowProgress, saveFlowProgress, type FlowProgress,
} from "@/lib/state/flowProgress";

export function useFlowProgress(
  motionId: string
): [FlowProgress, (patch: Partial<FlowProgress>) => void] {
  const [progress, setProgress] = useState<FlowProgress>(emptyFlowProgress());

  useEffect(() => {
    setProgress(loadFlowProgress(window.localStorage, motionId));
  }, [motionId]);

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
