"use client";
import { motion, type HTMLMotionProps } from "motion/react";
import type { ReactNode } from "react";
import { riseIn, transitions } from "@/lib/motion";

/** Fade+rise entrance for standalone/div content. `index` staggers grids/lists. */
export function Rise({
  children,
  index = 0,
  className,
}: {
  children: ReactNode;
  index?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      variants={riseIn}
      initial="hidden"
      animate="show"
      transition={{ ...transitions.gentle, delay: index * 0.05 }}
    >
      {children}
    </motion.div>
  );
}

/**
 * An animated button: the same fade+rise entrance (staggered by `index`) plus a
 * subtle hover/tap scale. Drop-in for an existing <button> — forwards all button
 * props (className, onClick, aria-label, disabled, type, children).
 */
export function Pressable({ index = 0, ...props }: HTMLMotionProps<"button"> & { index?: number }) {
  return (
    <motion.button
      variants={riseIn}
      initial="hidden"
      animate="show"
      whileHover={{ scale: 1.02, y: -1, transition: transitions.snappy }}
      whileTap={{ scale: 0.98, y: 0, transition: transitions.snappy }}
      transition={{ ...transitions.gentle, delay: index * 0.05 }}
      {...props}
    />
  );
}
