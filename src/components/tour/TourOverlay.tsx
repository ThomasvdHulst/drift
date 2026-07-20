"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { TourStep } from "@/lib/tour/steps";

// The tour's visual layer (Phase 20): a calm spotlight + a coach card, built to
// the "quiet reading room" look and to work on a small screen. The spotlight is
// four dim panels around the target's rect, leaving the real control tappable in
// the uncovered gap (no z-index pass-through hacks). The coach card is a top or
// bottom sheet placed opposite the target so it never covers the highlight.

const PAD = 8; // breathing room around the spotlighted element
const APPEAR_TIMEOUT_MS = 3200; // give up finding a target after this
const STALL_SKIP_MS = 7000; // reveal "Skip this step" on a forced step after this

type Place = "top" | "bottom" | "center";

function clamp(n: number): number {
  return n < 0 ? 0 : n;
}

export function TourOverlay({
  step,
  index,
  total,
  onNext,
  onSkip,
}: {
  step: TourStep;
  index: number;
  total: number;
  onNext: () => void;
  onSkip: () => void;
}) {
  const reduce = useReducedMotion();
  // This component is keyed by step.id in the provider, so it remounts per step
  // and each of these starts fresh (no synchronous reset needed in effects).
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [vp, setVp] = useState(() => ({
    w: typeof window !== "undefined" ? window.innerWidth : 0,
    h: typeof window !== "undefined" ? window.innerHeight : 0,
  }));
  const [stalled, setStalled] = useState(false);
  const scrolledRef = useRef(false);

  const forced = step.advance !== "next";
  const isLast = index >= total - 1;
  // A quiet "Skip this step" appears if a forced step stalls or a target never
  // shows, so the tour can always move on (§2/§4).
  const showStepSkip = stalled || notFound;

  // Track viewport size for placement math.
  useEffect(() => {
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Find + measure the target for this step. Polls (the element may load async,
  // e.g. the drift card after "Finding a starting point"), scrolls it into view
  // once, then keeps the rect fresh on scroll/resize. A target that never appears
  // sets `notFound`. All setState here happens inside rAF/listener callbacks.
  useEffect(() => {
    if (!step.target) return; // centered step, no anchor

    let cancelled = false;
    let raf = 0;
    let tries = 0;
    const maxTries = Math.round(APPEAR_TIMEOUT_MS / 16);
    let el: HTMLElement | null = null;

    const measure = () => {
      if (el) setRect(el.getBoundingClientRect());
    };

    // Keep the rect fresh while the element exists (the smooth scroll animates it,
    // inner scroll containers move it, and its own content can grow, e.g. thread
    // chips arriving async). Capture=true catches inner scrolls.
    const onMove = () => {
      if (!el) return;
      requestAnimationFrame(measure);
    };
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    const ro = new ResizeObserver(onMove);
    ro.observe(document.body);

    const find = () => {
      if (cancelled) return;
      const found = document.querySelector(
        `[data-tour="${step.target}"]`,
      ) as HTMLElement | null;
      if (found) {
        el = found;
        // Watch the target itself so the hole tracks it as its content loads.
        ro.observe(found);
        // Open a collapsed disclosure (e.g. the "drift within a field" details)
        // so its content is visible while spotlighted.
        if (found instanceof HTMLDetailsElement) found.open = true;
        if (!scrolledRef.current) {
          scrolledRef.current = true;
          try {
            found.scrollIntoView({ block: "center", behavior: "smooth" });
          } catch {
            /* older browsers: measure in place */
          }
        }
        measure();
        return;
      }
      tries++;
      if (tries >= maxTries) {
        setNotFound(true);
        return;
      }
      raf = requestAnimationFrame(find);
    };
    raf = requestAnimationFrame(find);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
      ro.disconnect();
    };
  }, [step.target]);

  // On a forced step, reveal "Skip this step" if it stalls (setState in a timer
  // callback, so it's off the effect body).
  useEffect(() => {
    if (!forced) return;
    const t = setTimeout(() => setStalled(true), STALL_SKIP_MS);
    return () => clearTimeout(t);
  }, [forced]);

  const hasSpotlight = step.spotlight && !!rect && !notFound;

  // Placement: keep the coach card clear of the target and of the swipe zone.
  const place: Place =
    step.gestureHint === "swipe-up" || step.gestureHint === "swipe-side"
      ? "top"
      : !hasSpotlight || step.placement === "center"
        ? "center"
        : rect && rect.top + rect.height / 2 > vp.h * 0.5
          ? "top"
          : "bottom";

  // Block stray wheel/touch so the feed's gesture handler never reads a tour tap
  // as a drift (mirrors FirstRunCoach). Only the forced-swipe steps let gestures
  // pass through to the app beneath; other non-spotlight steps (the intro card,
  // the outro) keep a calm blocking scrim so the app shows but isn't touchable.
  const passThrough =
    step.gestureHint === "swipe-up" || step.gestureHint === "swipe-side";
  const stop = passThrough
    ? undefined
    : (e: { stopPropagation: () => void }) => e.stopPropagation();

  const dimClass = "bg-ink/45";

  return (
    <div
      className="pointer-events-none fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label={step.title}
    >
      {/* Backdrop / spotlight */}
      {hasSpotlight && rect ? (
        <>
          {/* Four dim panels around the target rect (the gap stays tappable). */}
          {[
            { top: 0, left: 0, width: vp.w, height: clamp(rect.top - PAD) },
            {
              top: clamp(rect.bottom + PAD),
              left: 0,
              width: vp.w,
              height: clamp(vp.h - (rect.bottom + PAD)),
            },
            {
              top: clamp(rect.top - PAD),
              left: 0,
              width: clamp(rect.left - PAD),
              height: clamp(rect.height + 2 * PAD),
            },
            {
              top: clamp(rect.top - PAD),
              left: clamp(rect.right + PAD),
              width: clamp(vp.w - (rect.right + PAD)),
              height: clamp(rect.height + 2 * PAD),
            },
          ].map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: reduce ? 0 : 0.3 }}
              onWheel={stop}
              onTouchStart={stop}
              onTouchEnd={stop}
              className={`pointer-events-auto fixed ${dimClass} backdrop-blur-[1px]`}
              style={{ top: s.top, left: s.left, width: s.width, height: s.height }}
            />
          ))}
          {/* Highlight ring over the uncovered target (never blocks its taps). */}
          <div
            className="pointer-events-none fixed rounded-xl ring-2 ring-accent-strong/80"
            style={{
              top: clamp(rect.top - PAD),
              left: clamp(rect.left - PAD),
              width: rect.width + 2 * PAD,
              height: rect.height + 2 * PAD,
            }}
          />
        </>
      ) : (
        // No cutout: a light scrim. Pass-through for the swipe step (so the real
        // gesture reaches the drift page); blocking otherwise.
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: reduce ? 0 : 0.3 }}
          onWheel={stop}
          onTouchStart={stop}
          onTouchEnd={stop}
          className={`fixed inset-0 ${passThrough ? "pointer-events-none bg-ink/20" : "pointer-events-auto bg-ink/30"} backdrop-blur-[1px]`}
        />
      )}

      {/* Coach card */}
      <div
        className={
          place === "top"
            ? "pointer-events-none fixed inset-x-0 top-0 flex justify-center px-4 pt-safe"
            : place === "bottom"
              ? "pointer-events-none fixed inset-x-0 bottom-0 flex justify-center px-4 pb-safe"
              : "pointer-events-none fixed inset-0 flex items-end justify-center p-4 sm:items-center"
        }
      >
        <motion.div
          initial={
            reduce
              ? { opacity: 0 }
              : { opacity: 0, y: place === "top" ? -16 : 16 }
          }
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: "easeOut" }}
          onWheel={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
          className={`pointer-events-auto w-full max-w-sm rounded-2xl bg-paper-raised p-5 shadow-xl ring-1 ring-line ${place === "top" ? "mt-3" : place === "bottom" ? "mb-3" : ""}`}
        >
          {/* Calm progress: a slim fraction bar, no daunting "n of many" count. */}
          <div className="mb-3 h-1 w-full overflow-hidden rounded-full bg-ink/10">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${Math.round(((index + 1) / total) * 100)}%` }}
            />
          </div>

          <h2 className="font-serif text-xl leading-snug text-ink">{step.title}</h2>
          {(Array.isArray(step.body) ? step.body : [step.body]).map((p, i) => (
            <p key={i} className="mt-2 text-sm leading-relaxed text-ink-soft">
              {p}
            </p>
          ))}

          {step.gestureHint && <GestureHint hint={step.gestureHint} reduce={!!reduce} />}

          <div className="mt-5 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onSkip}
              className="text-xs font-medium text-ink-soft underline-offset-2 transition hover:text-ink hover:underline"
            >
              Skip tour
            </button>

            {forced ? (
              showStepSkip ? (
                <button
                  type="button"
                  onClick={onNext}
                  className="text-xs font-medium text-accent-strong underline-offset-2 transition hover:underline"
                >
                  Skip this step
                </button>
              ) : (
                <span className="text-xs italic text-ink-soft">
                  {notFound ? "One moment…" : "Try it above"}
                </span>
              )
            ) : (
              <button
                type="button"
                onClick={onNext}
                className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-paper-raised shadow-sm transition hover:bg-accent-strong"
              >
                {isLast ? "Finish" : "Next"}
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// A small animated cue for a forced gesture. Calm and quiet, reduced-motion aware.
function GestureHint({ hint, reduce }: { hint: TourStep["gestureHint"]; reduce: boolean }) {
  const label =
    hint === "swipe-up"
      ? "Swipe up"
      : hint === "swipe-side"
        ? "Swipe sideways"
        : "Tap";
  const anim = reduce
    ? {}
    : hint === "swipe-up"
      ? { y: [6, -6, 6] }
      : hint === "swipe-side"
        ? { x: [-6, 6, -6] }
        : { scale: [1, 1.15, 1] };
  return (
    <div className="mt-3 flex items-center gap-2 text-accent-strong">
      <motion.span
        aria-hidden="true"
        animate={anim}
        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        className="text-lg"
      >
        {hint === "swipe-up" ? "↑" : hint === "swipe-side" ? "↔" : "◉"}
      </motion.span>
      <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
    </div>
  );
}
