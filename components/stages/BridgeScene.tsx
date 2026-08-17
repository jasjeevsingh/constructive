"use client";
import { AnimatePresence, motion, useReducedMotion, type Transition } from "motion/react";
import { transitions } from "@/lib/motion";
import { cn } from "@/lib/utils";

type SceneMaterial = "evidence" | "reasoning";

/** Minimal inline traveler — a swappable placeholder for the later mascot system. */
function Traveler() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden>
      <circle cx="10" cy="5" r="3" className="fill-primary" />
      <rect x="6.5" y="8" width="7" height="9" rx="2.5" className="fill-primary" />
    </svg>
  );
}

function Pier() {
  return <div className="h-16 w-7 shrink-0 self-end rounded-t bg-muted-foreground/25" />;
}

export function BridgeScene({
  placed,
  testResult,
}: {
  placed: { id: string; material: SceneMaterial }[];
  testResult: "held" | "failed" | null;
}) {
  const reduced = useReducedMotion() ?? false;

  const travelerState =
    testResult === "held" ? "crossed" : testResult === "failed" ? "stopped" : "idle";

  const travelerAnim =
    travelerState === "crossed"
      ? { left: "88%" }
      : travelerState === "stopped"
        ? { left: reduced ? "30%" : ["0%", "35%", "30%"] }
        : { left: "0%" };

  const travelerTransition: Transition = reduced
    ? { duration: 0 }
    : travelerState === "crossed"
      ? { duration: 0.9, ease: "easeInOut" }
      : travelerState === "stopped"
        ? { duration: 0.6, ease: "easeInOut" }
        : transitions.gentle;

  const deckWobble = testResult === "failed" && !reduced;

  return (
    <div
      aria-hidden
      data-testid="bridge-scene"
      className="mb-4 overflow-hidden rounded-xl border border-border bg-gradient-to-b from-primary/5 to-background p-4"
    >
      <div className="flex h-24 items-end gap-1">
        <Pier />
        <div className="relative flex-1 self-center">
          {/* traveler track, just above the deck */}
          <motion.div
            className="absolute -top-5 z-10"
            initial={false}
            animate={travelerAnim}
            transition={travelerTransition}
          >
            <Traveler />
          </motion.div>

          {/* deck */}
          <motion.div
            className={cn(
              "flex min-h-[16px] items-center justify-center gap-1 rounded-md p-1 transition-colors",
              testResult === "held" && "bg-success/10 ring-1 ring-success"
            )}
            animate={deckWobble ? { x: [0, -4, 4, -3, 3, 0] } : { x: 0 }}
            transition={deckWobble ? { duration: 0.5, delay: 0.5 } : { duration: 0 }}
          >
            {placed.length === 0 ? (
              <div className="h-2 w-2/3 rounded border-2 border-dashed border-border/60" />
            ) : (
              <AnimatePresence initial={false}>
                {placed.map((p) => (
                  <motion.div
                    key={p.id}
                    data-testid="bridge-beam"
                    className={cn(
                      "h-3 w-8 rounded-sm",
                      p.material === "evidence" ? "bg-evidence" : "bg-reasoning"
                    )}
                    initial={reduced ? false : { y: -24, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={reduced ? { opacity: 0 } : { y: 24, opacity: 0 }}
                    transition={reduced ? { duration: 0 } : transitions.spring}
                  />
                ))}
              </AnimatePresence>
            )}
          </motion.div>
        </div>
        <Pier />
      </div>
    </div>
  );
}
