"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react";
import type { Thread, ThreadKind } from "@/lib/types";
import { ThreadChips, KindIcon, KIND_META } from "@/components/ThreadChips";
import { DEMO_START_ID, demoCardById } from "./data";

// The interactive centerpiece: a tiny, self-contained rabbit hole a visitor can
// actually steer before signing up. Tapping a thread slides the next card in
// diagonally (the app's signature "pulled sideways" move, mirroring the /drift
// cardVariants + spring); a breadcrumb grows so the "sessions have shape" idea is
// felt, not told. Nothing moves on its own — that's the whole point (§2.2). All
// content is bundled (lib/landing/data) — no network. Honors reduced motion.

type Arrival =
  | { mode: "start" }
  | { mode: "thread"; kind: ThreadKind; label: string }
  | { mode: "drift" };

const spring = { type: "spring", stiffness: 260, damping: 30 } as const;

// "thread" = diagonal pull, "drift" = a softer vertical advance. Mirrors /drift.
type Dir = "thread" | "drift";

export function ThreadDemo() {
  const reduce = useReducedMotion();
  const [id, setId] = useState(DEMO_START_ID);
  const [dir, setDir] = useState<Dir>("thread");
  const [arrival, setArrival] = useState<Arrival>({ mode: "start" });
  const [path, setPath] = useState<string[]>([DEMO_START_ID]);

  const card = demoCardById(id)!;
  const pulls = path.length - 1;

  const variants: Variants = {
    enter: (d: Dir) =>
      reduce
        ? { opacity: 0 }
        : d === "drift"
          ? { y: 56, opacity: 0 }
          : { x: 84, y: -14, opacity: 0, rotate: 1.2 },
    center: { x: 0, y: 0, opacity: 1, rotate: 0 },
    exit: (d: Dir) =>
      reduce
        ? { opacity: 0 }
        : d === "drift"
          ? { y: -56, opacity: 0 }
          : { x: -104, y: -18, opacity: 0, rotate: -1.2 },
  };

  // Map the demo card's threads onto the real Thread shape so we can render them
  // with the exact same <ThreadChips/> the app uses (same look, same vocabulary).
  const threads: Thread[] = card.threads.map((t) => ({
    candidate: {
      pageTitle: t.to,
      displayTitle: t.label,
      source: "artic",
    },
    label: t.label,
    kind: t.kind,
  }));

  function goTo(nextId: string, direction: Dir, arr: Arrival) {
    setDir(direction);
    setArrival(arr);
    setId(nextId);
    setPath((p) => [...p, nextId]);
  }

  function onThread(thread: Thread) {
    goTo(thread.candidate.pageTitle, "thread", {
      mode: "thread",
      kind: thread.kind ?? "nearby",
      label: thread.label,
    });
  }

  function drift() {
    // Advance to a random *other* card — the neutral "let curiosity wander" move.
    const others = card.threads
      .map((t) => t.to)
      .filter((x) => x !== id);
    const pick = others[Math.floor(Math.random() * others.length)] ?? id;
    goTo(pick, "drift", { mode: "drift" });
  }

  function reset() {
    setDir("drift");
    setArrival({ mode: "start" });
    setId(DEMO_START_ID);
    setPath([DEMO_START_ID]);
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      {/* The card stage — fixed height so the diagonally-sliding cards overlay
          cleanly (both are absolutely positioned during the transition). */}
      <div className="relative h-[32rem] sm:h-[25rem]">
        <AnimatePresence custom={dir} initial={false}>
          <motion.div
            key={id}
            custom={dir}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={spring}
            className="absolute inset-0"
          >
            <div className="flex h-full w-full flex-col overflow-hidden rounded-2xl bg-paper-raised shadow-[0_10px_40px_-12px_rgba(43,39,35,0.25)] ring-1 ring-line sm:flex-row">
              <div className="relative h-44 w-full shrink-0 overflow-hidden bg-ink/[0.04] sm:h-full sm:w-1/2">
                <img
                  src={card.image}
                  alt={card.title}
                  className="h-full w-full object-cover"
                  draggable={false}
                />
              </div>

              <div className="flex min-h-0 flex-1 flex-col">
                <div className="min-h-0 flex-1 overflow-hidden px-5 pt-5 sm:px-6 sm:pt-6">
                  <ModeChip arrival={arrival} />
                  {card.description && (
                    <p className="mt-3 text-xs font-medium uppercase tracking-wide text-ink-soft">
                      {card.description}
                    </p>
                  )}
                  <h3 className="mt-1 font-serif text-2xl leading-tight text-ink">
                    {card.title}
                  </h3>
                  <p className="mt-2 line-clamp-4 text-sm leading-relaxed text-ink/80">
                    {card.extract}
                  </p>
                </div>

                <div className="flex shrink-0 flex-col gap-2.5 border-t border-line px-5 py-4 sm:px-6">
                  <p className="text-[11px] font-medium uppercase tracking-widest text-ink-soft">
                    Pull a thread
                  </p>
                  <ThreadChips
                    threads={threads}
                    loading={false}
                    onThread={onThread}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Breadcrumb + controls — the growing trail. */}
      <div className="mt-5 flex flex-col items-center gap-3">
        <Breadcrumb path={path} reduce={!!reduce} />

        <div className="flex items-center gap-2 text-sm">
          <button
            type="button"
            onClick={drift}
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper-raised px-4 py-1.5 font-medium text-ink-soft transition hover:border-accent/50 hover:text-accent-strong"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M2 12c2.5-4 5.5-4 8 0s5.5 4 8 0" />
            </svg>
            Or just drift
          </button>
          {pulls > 0 && (
            <button
              type="button"
              onClick={reset}
              className="rounded-full px-3 py-1.5 text-ink-soft transition hover:text-ink"
            >
              Start over
            </button>
          )}
        </div>

        {/* Gentle guidance, never a countdown or a tease (§2). */}
        <p className="h-5 text-center text-xs text-ink-soft" aria-live="polite">
          {pulls === 0
            ? "Tap a thread above. You choose every turn."
            : pulls < 3
              ? `${pulls} ${pulls === 1 ? "stop" : "stops"} so far.`
              : `${pulls} stops, and this little wander is becoming a trail.`}
        </p>
      </div>
    </div>
  );
}

function ModeChip({ arrival }: { arrival: Arrival }) {
  if (arrival.mode === "thread") {
    return (
      <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-accent-strong ring-1 ring-accent/30">
        <KindIcon kind={arrival.kind} size={12} />
        {KIND_META[arrival.kind].word} · {arrival.label}
      </span>
    );
  }
  const label = arrival.mode === "start" ? "Starting point" : "Drifting";
  return (
    <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-ink/5 px-3 py-1 text-xs font-medium uppercase tracking-wide text-ink-soft">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2 12c2.5-4 5.5-4 8 0s5.5 4 8 0" />
      </svg>
      {label}
    </span>
  );
}

// The trail breadcrumb — dots for each stop, the current one filled + sage. Shows
// the last several so a long wander doesn't overflow. A quiet echo of the app's
// trail rail; it's what the trail map is built from.
function Breadcrumb({ path, reduce }: { path: string[]; reduce: boolean }) {
  const shown = path.slice(-7);
  const trimmed = path.length > shown.length;
  return (
    <div className="flex items-center gap-1.5" aria-hidden="true">
      {trimmed && <span className="text-xs text-ink-soft">…</span>}
      {shown.map((stepId, i) => {
        const isCurrent = i === shown.length - 1;
        return (
          <div key={`${stepId}-${i}`} className="flex items-center gap-1.5">
            {i > 0 && <span className="h-px w-4 bg-line" />}
            <motion.span
              initial={reduce ? false : { scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 24 }}
              className={
                isCurrent
                  ? "h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-accent/25"
                  : "h-2 w-2 rounded-full bg-ink/25"
              }
            />
          </div>
        );
      })}
    </div>
  );
}
