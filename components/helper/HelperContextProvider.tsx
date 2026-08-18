"use client";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { emptyHelperContext, type HelperContext } from "@/lib/helper/context";

type Store = { ctx: HelperContext; publish: (patch: Partial<HelperContext>) => void };

const Ctx = createContext<Store | null>(null);

export function HelperContextProvider({ children }: { children: ReactNode }) {
  const [ctx, setCtx] = useState<HelperContext>(emptyHelperContext);
  const value = useMemo<Store>(
    () => ({
      ctx,
      publish: (patch) =>
        setCtx((prev) => {
          // Skip no-op updates so publishers can call this on every render.
          const next = { ...prev, ...patch };
          for (const k of Object.keys(patch) as (keyof HelperContext)[]) {
            if (JSON.stringify(prev[k]) !== JSON.stringify(next[k])) return next;
          }
          return prev;
        }),
    }),
    [ctx]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Publish a slice of page context. Safe outside a provider (no-op), so a
 *  component mounted under two different hosts needs no special casing. */
export function usePublishHelperContext(patch: Partial<HelperContext>): void {
  const store = useContext(Ctx);
  const key = JSON.stringify(patch);
  useEffect(() => {
    store?.publish(JSON.parse(key) as Partial<HelperContext>);
  }, [store, key]);
}

export function useHelperContext(): HelperContext {
  return useContext(Ctx)?.ctx ?? emptyHelperContext();
}
