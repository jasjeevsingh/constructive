"use client";
import { useCallback, useEffect, useState } from "react";
import {
  emptyLinkProgress,
  loadLinkProgress,
  saveLinkProgress,
  type LinkProgress,
} from "@/lib/state/linkProgress";

export function useLinkProgress(
  scenarioId: string
): [LinkProgress, (patch: Partial<LinkProgress>) => void] {
  const [progress, setProgress] = useState<LinkProgress>(emptyLinkProgress());

  useEffect(() => {
    setProgress(loadLinkProgress(window.localStorage, scenarioId));
  }, [scenarioId]);

  const update = useCallback(
    (patch: Partial<LinkProgress>) => {
      setProgress((prev) => {
        const next = { ...prev, ...patch };
        saveLinkProgress(window.localStorage, scenarioId, next);
        return next;
      });
    },
    [scenarioId]
  );

  return [progress, update];
}
