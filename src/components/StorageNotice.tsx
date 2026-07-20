"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { adsConfig, adsenseScriptEnabled } from "@/lib/ads";

const SEEN_KEY = "drift-notice-seen";
// Honest disclosure flips as soon as the AdSense script is configured (Phase 21);
// OFF by default.
const USES_ADSENSE = adsenseScriptEnabled(adsConfig());

// A one-time, calm "cookie notice" shown on the first visit to the site. Drift
// uses no tracking cookies / analytics / ads (only strictly-necessary functional
// storage), so this is transparency rather than a consent gate: it states plainly
// that there's nothing to opt out of and links to the full note. Non-blocking,
// dismissible, once per device (localStorage) — no nagging (§2). Mounted globally
// so it appears on the landing page too, before an account exists.
export function StorageNotice() {
  const [show, setShow] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    // Defer off the effect body (React 19 render-purity rule).
    queueMicrotask(() => {
      try {
        if (!localStorage.getItem(SEEN_KEY)) setShow(true);
      } catch {
        // Storage disabled (private mode): just don't show it.
      }
    });
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      // Ignore — worst case it shows again next visit, which is harmless.
    }
    setShow(false);
  }

  if (!show) return null;

  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="fixed inset-x-0 bottom-safe z-40 flex justify-center px-4"
      role="region"
      aria-label="How Drift uses storage"
    >
      <div className="flex w-full max-w-lg flex-col gap-3 rounded-2xl bg-paper-raised p-4 shadow-xl ring-1 ring-line sm:flex-row sm:items-center sm:gap-4 sm:p-5">
        <p className="text-sm leading-relaxed text-ink-soft">
          {USES_ADSENSE
            ? "Drift keeps your account and trails so they work across your devices, and uses Google AdSense, which may set cookies with your consent. "
            : "Drift keeps your account and trails so it works across your devices. No tracking, no ads, no third-party cookies. "}
          <Link
            href="/privacy"
            className="text-accent-strong underline-offset-2 hover:underline"
          >
            What we store
          </Link>
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 self-end rounded-full bg-accent px-5 py-2 text-sm font-semibold text-paper-raised shadow-sm transition hover:bg-accent-strong sm:self-auto"
        >
          Got it
        </button>
      </div>
    </motion.div>
  );
}
