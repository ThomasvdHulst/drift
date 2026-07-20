"use client";

import { useEffect, useRef } from "react";
import { adsenseReady, type AdsConfig } from "@/lib/ads";

// A single, calm, clearly-labeled ad shown as its own "stop" every ~N drifts
// (Phase 21). Styled like a knowledge card so it fits the reading room, but it is
// never a knowledge card: it carries no threads/reactions and is never saved to a
// trail. No autoplay: the user leaves it with the normal advance gesture (scroll /
// swipe / Drift onward), same as any card. Placeholder mode needs no AdSense and
// sets no cookies; the AdSense branch renders only when the ids are configured.

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

export function AdCard({ config }: { config: AdsConfig }) {
  const useAdsense = adsenseReady(config);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-2xl bg-paper-raised shadow-[0_10px_40px_-12px_rgba(43,39,35,0.25)] ring-1 ring-line">
      <div className="flex min-h-0 flex-1 flex-col px-6 py-6 sm:px-10 sm:py-10">
        <p className="text-xs font-medium uppercase tracking-widest text-ink-soft">
          Sponsored
        </p>

        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 py-6 text-center">
          {useAdsense ? (
            <AdsenseUnit client={config.client!} slot={config.slot!} />
          ) : (
            <Placeholder />
          )}
        </div>

        {/* Same quiet wayfinding cue as a knowledge card: leave it by drifting on,
            never an autoplay/countdown (§2). */}
        <p className="pt-1 text-center text-xs text-ink-soft/70">
          ⌄ keep scrolling to continue
        </p>
      </div>
    </div>
  );
}

// The calm house card (no AdSense, no cookies): lets us feel the cadence + layout
// with nothing third-party loaded.
function Placeholder() {
  return (
    <>
      <span
        aria-hidden="true"
        className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent-strong"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3 9h18" />
        </svg>
      </span>
      <h2 className="max-w-sm font-serif text-2xl leading-tight text-ink">
        A quiet place for an ad
      </h2>
      <p className="max-w-sm text-sm leading-relaxed text-ink-soft">
        Ads like this one would help keep Drift free. This is a placeholder while
        we design the experience. An ad-free option is planned.
      </p>
    </>
  );
}

// The real AdSense in-feed / responsive display unit. Renders an <ins> and asks
// AdSense to fill it once, with a single retry in case the script (loaded in the
// layout) is not ready yet. Keyed by mount: the parent unmounts this between ads,
// so each placement is a fresh push.
function AdsenseUnit({ client, slot }: { client: string; slot: string }) {
  const pushedRef = useRef(false);

  useEffect(() => {
    if (pushedRef.current) return;
    let timer: number | undefined;
    const push = () => {
      if (pushedRef.current) return;
      try {
        if (typeof window !== "undefined" && Array.isArray(window.adsbygoogle)) {
          window.adsbygoogle.push({});
          pushedRef.current = true;
        } else {
          // Script not ready yet: retry once shortly.
          timer = window.setTimeout(() => {
            try {
              (window.adsbygoogle = window.adsbygoogle || []).push({});
              pushedRef.current = true;
            } catch {
              /* leave the slot empty rather than break the feed */
            }
          }, 750);
        }
      } catch {
        /* never let an ad failure break drifting (§4) */
      }
    };
    push();
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  return (
    <ins
      className="adsbygoogle"
      style={{ display: "block", width: "100%", minHeight: 250 }}
      data-ad-client={client}
      data-ad-slot={slot}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  );
}
