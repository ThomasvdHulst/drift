"use client";

import { motion, useReducedMotion } from "motion/react";
import { Monogram } from "@/components/BrandLogo";

// The first-run welcome (Phase 20): a calm popup that says what Drift is and
// offers the guided tour. Declining is one tap and it never nags (§2). Shown once
// per account (the provider gates it on synced settings). This absorbs the old
// FirstRunCoach intro.
export function WelcomeModal({
  onStart,
  onDismiss,
}: {
  onStart: () => void;
  onDismiss: () => void;
}) {
  const reduce = useReducedMotion();
  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduce ? 0 : 0.3 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 backdrop-blur-sm sm:items-center"
      onWheel={stop}
      onTouchStart={stop}
      onTouchEnd={stop}
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Drift"
    >
      <motion.div
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="w-full max-w-md rounded-2xl bg-paper-raised p-6 shadow-xl ring-1 ring-line sm:p-7"
      >
        <Monogram className="h-9" alt="Drift" />
        <p className="mt-4 text-xs font-medium uppercase tracking-widest text-ink-soft">
          Welcome to Drift
        </p>
        <h2 className="mt-1 font-serif text-2xl leading-tight text-ink sm:text-3xl">
          You are the algorithm
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          A calm feed of knowledge cards, with no autoplay and no hidden ranking.
          You pull threads to steer your own path, and every session ends with a
          map of where your curiosity wandered.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          Want a quick walkthrough? It takes a minute and you can leave anytime.
        </p>

        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row-reverse">
          <button
            type="button"
            onClick={onStart}
            className="w-full rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-paper-raised shadow-sm transition hover:bg-accent-strong sm:w-auto"
          >
            Take the quick tour
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="w-full rounded-full border border-line px-6 py-2.5 text-sm font-medium text-ink transition hover:border-accent/50 hover:text-accent-strong sm:w-auto"
          >
            Maybe later
          </button>
        </div>
        <p className="mt-4 text-center text-xs leading-snug text-ink/55">
          You can start the tour anytime from the home page or your account.
        </p>
      </motion.div>
    </motion.div>
  );
}
