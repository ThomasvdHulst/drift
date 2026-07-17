"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

// A gentle scroll-reveal: content fades + rises the first time it scrolls into
// view, then stays put (`once`). Honors prefers-reduced-motion — when set, it
// renders a plain div with no transform, so the calm-by-default promise holds for
// anyone who's asked the OS to still their motion.
export function Reveal({
  children,
  className,
  delay = 0,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "section" | "li";
}) {
  const reduce = useReducedMotion();
  const MotionTag = motion[as];

  if (reduce) {
    const Tag = as;
    return <Tag className={className}>{children}</Tag>;
  }

  return (
    <MotionTag
      className={className}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.5, ease: "easeOut", delay }}
    >
      {children}
    </MotionTag>
  );
}
