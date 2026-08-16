import type { Transition, Variants } from "motion/react";

export const transitions: Record<"gentle" | "snappy" | "spring", Transition> = {
  gentle: { duration: 0.4, ease: "easeOut" },
  snappy: { duration: 0.18, ease: "easeOut" },
  spring: { type: "spring", stiffness: 320, damping: 26 },
};

export const riseIn: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0 },
};
