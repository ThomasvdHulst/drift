"use client";

import { useEffect, useState } from "react";

const SEEN_KEY = "drift-coach-seen";

// A one-time, gentle "how this works" for a brand-new drifter. A signed-up user
// lands straight in the feed, past the logged-out landing demo — so the core
// mechanic (pull threads to steer; drift to wander; end to see your trail) gets a
// single calm introduction, shown once per device and never again. §2: no
// nagging, no autoplay, fully dismissible; it teaches agency, it doesn't push.
export function FirstRunCoach({ ready }: { ready: boolean }) {
  // Start hidden to match SSR; decide after mount from localStorage.
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!ready) return;
    // Defer the state update off the effect body (React 19 render-purity rule).
    queueMicrotask(() => {
      try {
        if (!localStorage.getItem(SEEN_KEY)) setShow(true);
      } catch {
        // Private mode / storage disabled: just don't show the coach.
      }
    });
  }, [ready]);

  function dismiss() {
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      // Ignore — worst case it shows again next time, which is harmless.
    }
    setShow(false);
  }

  if (!show) return null;

  // stopPropagation so a tap/scroll while dismissing isn't read as a drift by the
  // feed's gesture handlers on the container above.
  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

  return (
    <div
      className="absolute inset-0 z-30 flex items-end justify-center bg-ink/30 p-4 backdrop-blur-[2px] sm:items-center"
      onWheel={stop}
      onTouchStart={stop}
      onTouchEnd={stop}
      role="dialog"
      aria-modal="true"
      aria-label="How Drift works"
    >
      <div className="w-full max-w-sm rounded-2xl bg-paper-raised p-6 shadow-xl ring-1 ring-line">
        <p className="text-xs font-medium uppercase tracking-widest text-ink-soft">
          Welcome
        </p>
        <h2 className="mt-1 font-serif text-2xl text-ink">You are the algorithm</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          There is no feed deciding for you here. You steer.
        </p>
        <ul className="mt-4 space-y-3 text-sm text-ink">
          <li className="flex gap-3">
            <span aria-hidden="true" className="text-accent-strong">↝</span>
            <span>
              <span className="font-medium">Pull a thread</span> at the bottom of
              a card to follow a direction that interests you.
            </span>
          </li>
          <li className="flex gap-3">
            <span aria-hidden="true" className="text-accent-strong">↧</span>
            <span>
              <span className="font-medium">Scroll on</span> to drift to something
              new when nothing pulls you.
            </span>
          </li>
          <li className="flex gap-3">
            <span aria-hidden="true" className="text-accent-strong">✦</span>
            <span>
              <span className="font-medium">End anytime</span> to see the trail
              map of where your curiosity wandered.
            </span>
          </li>
        </ul>
        <button
          type="button"
          onClick={dismiss}
          className="mt-6 w-full rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-paper-raised shadow-sm transition hover:bg-accent-strong"
        >
          Start drifting
        </button>
      </div>
    </div>
  );
}
