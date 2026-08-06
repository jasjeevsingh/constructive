"use client";
import { useCallback, useEffect, useState } from "react";
import {
  emptyProgress,
  loadProgress,
  saveProgress,
  type MotionProgress,
} from "@/lib/state/progressStore";

export function useMotionProgress(
  motionId: string
): [MotionProgress, (patch: Partial<MotionProgress>) => void] {
  const [progress, setProgress] = useState<MotionProgress>(emptyProgress());

  // Hydrate from localStorage on mount (client only).
  useEffect(() => {
    setProgress(loadProgress(window.localStorage, motionId));
  }, [motionId]);

  const update = useCallback(
    (patch: Partial<MotionProgress>) => {
      setProgress((prev) => {
        const next = { ...prev, ...patch };
        saveProgress(window.localStorage, motionId, next);
        return next;
      });
    },
    [motionId]
  );

  return [progress, update];
}
