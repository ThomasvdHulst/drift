"use client";

import { useEffect, useState } from "react";

// Small client helpers for the /install guide. The page itself is a static server
// component; these add the two bits that need the browser: an "already installed"
// note and a gentle "you're on iOS/Android" hint.

// A calm note shown only when the page is already open as an installed app.
export function StandaloneNote() {
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    queueMicrotask(() => {
      try {
        if (isStandalone()) setInstalled(true);
      } catch {
        // ignore
      }
    });
  }, []);
  if (!installed) return null;
  return (
    <div className="rounded-2xl border border-accent/30 bg-accent/10 p-4 text-sm leading-relaxed text-ink">
      You are already using Drift as an app. Nice. Nothing more to do here.
    </div>
  );
}

type Platform = "ios" | "android" | "desktop";

/** Which set of install steps this visitor needs. Browser-only: it reads the user
 *  agent, so it must never run during the server render. Extracted because the
 *  /install hint and the /start block below have to agree about what a phone is;
 *  when they each sniffed for themselves, they could disagree on an iPad. */
function detectPlatform(): Platform {
  const ua = window.navigator.userAgent || "";
  const iOS =
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS 13+ reports as Mac; detect the touch Mac case.
    (ua.includes("Macintosh") && "ontouchend" in window);
  if (iOS) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

/** Whether Drift is already open as an installed app. */
function isStandalone(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

// A one-line "here's the section for your device" nudge. Renders nothing until the
// platform is known (avoids any hydration mismatch), and nothing on desktop.
export function PlatformHint() {
  const [platform, setPlatform] = useState<Platform | null>(null);
  useEffect(() => {
    queueMicrotask(() => {
      try {
        setPlatform(detectPlatform());
      } catch {
        // ignore
      }
    });
  }, []);
  if (!platform || platform === "desktop") return null;
  return (
    <p className="text-sm text-ink-soft">
      It looks like you are on {platform === "ios" ? "an iPhone or iPad" : "Android"}.
      Follow the {platform === "ios" ? "Safari" : "Chrome"} steps below.
    </p>
  );
}

// ---------------------------------------------------------------------------
// The install block for /start, the page a QR code lands on.
//
// /install is a page you CHOOSE to visit, so it can afford to explain both
// platforms and let you read. /start is a page you arrive at from a sticker,
// holding a phone, having never heard of Drift, so this version asks for the
// fewest possible taps and shows only the steps that apply to you.
//
// Three states, best first:
//   1. Already installed       -> say so and get out of the way.
//   2. Chrome offered a prompt -> one button, one tap, no reading at all.
//   3. Everything else         -> the written steps for THIS platform.
//
// State 3 is also the server-rendered HTML and what a reader with JavaScript
// off keeps, which is why it starts with both platforms and narrows in an
// effect: the first client render must match the server's or React replaces the
// tree, so the narrowing cannot happen during render. Same reasoning as
// PlatformHint above.

/** Chrome's `beforeinstallprompt`. Not in lib.dom, and only the member we call
 *  is declared. */
type InstallPromptEvent = Event & { prompt: () => Promise<void> };

/** Where the pre-hydration script on /start parks the captured event. */
type StashWindow = Window & { __driftInstall?: InstallPromptEvent | null };

export function StartInstall() {
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [installed, setInstalled] = useState(false);
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    // The event has usually ALREADY fired by now, which is the whole reason
    // /start carries an inline script to catch it before React mounts. Listen
    // for both the custom event that script dispatches and the real one, in
    // case this component happened to mount first. Subscribing is synchronous
    // so nothing can slip through between mount and the microtask below.
    const stash = window as StashWindow;

    const onStashed = () => setPrompt(stash.__driftInstall ?? null);
    const onNative = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPromptEvent);
    };
    // Chrome fires this once the app is actually installed, from the prompt or
    // from the browser menu. Swap straight to the "you're set" state.
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
    };

    window.addEventListener("drift:installable", onStashed);
    window.addEventListener("beforeinstallprompt", onNative);
    window.addEventListener("appinstalled", onInstalled);

    // Deferred, like the two helpers above: writing state straight from an
    // effect body cascades a second render before paint, and eslint's
    // react-hooks/set-state-in-effect rejects it.
    queueMicrotask(() => {
      try {
        setPlatform(detectPlatform());
        if (isStandalone()) setInstalled(true);
        if (stash.__driftInstall) setPrompt(stash.__driftInstall);
      } catch {
        // ignore: the written steps below are the fallback, and never wrong.
      }
    });

    return () => {
      window.removeEventListener("drift:installable", onStashed);
      window.removeEventListener("beforeinstallprompt", onNative);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) {
    return (
      <p className="rounded-2xl border border-accent/30 bg-accent/10 p-4 text-sm leading-relaxed text-ink">
        You are already reading Drift as an app. Nothing to do here.
      </p>
    );
  }

  // The one-tap path. Only Chrome ever offers it, and only when the app meets
  // its install criteria, so it is a bonus on top of the steps, never a
  // replacement for them.
  if (prompt) {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => {
            // If the prompt is refused or already consumed, this rejects. The
            // catch drops us back to the written steps, which still work.
            prompt.prompt().catch(() => setPrompt(null));
          }}
          className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-7 py-3 text-base font-semibold text-paper-raised shadow-sm transition hover:bg-accent-strong sm:w-auto"
        >
          Add Drift to your home screen
          <span aria-hidden="true">↓</span>
        </button>
        <p className="text-xs text-ink-soft">
          One tap. Drift gets its own icon and opens full screen, with no
          browser bar.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {(platform === null || platform === "ios") && (
        <InstallSteps
          heading={platform === null ? "On an iPhone or iPad" : "Three taps"}
          note="This works in Safari. If Drift opened inside another app's browser, open usedrift.org in Safari first."
          steps={[
            <>
              Tap the <B>Share</B> button, the square with an arrow pointing up.
            </>,
            <>
              Scroll down and tap <B>Add to Home Screen</B>.
            </>,
            <>
              Tap <B>Add</B>. Drift lands on your home screen with its own icon.
            </>,
          ]}
        />
      )}

      {(platform === null || platform === "android") && (
        <InstallSteps
          heading={platform === null ? "On Android" : "Three taps"}
          note="If Chrome offers an “Install app” prompt by itself, tap that instead and you are done."
          steps={[
            <>
              Tap the <B>⋮</B> menu, top right.
            </>,
            <>
              Tap <B>Add to Home screen</B>, or <B>Install app</B>.
            </>,
            <>
              Confirm. Drift lands on your home screen with its own icon.
            </>,
          ]}
        />
      )}

      {platform === "desktop" && (
        <p className="text-sm leading-relaxed text-ink-soft">
          You are on a computer, so there is no home screen to add to. Drift
          works here in the browser. To put it on a phone, open{" "}
          <span className="font-medium text-ink">usedrift.org</span> there and
          the steps will be waiting.
        </p>
      )}
    </div>
  );
}

function B({ children }: { children: React.ReactNode }) {
  return <span className="font-medium text-ink">{children}</span>;
}

function InstallSteps({
  heading,
  note,
  steps,
}: {
  heading: string;
  note: string;
  steps: React.ReactNode[];
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-soft">
        {heading}
      </p>
      <ol className="space-y-2 text-sm leading-relaxed text-ink">
        {steps.map((step, i) => (
          <li key={i} className="flex gap-3">
            <span
              className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-semibold text-accent-strong"
              aria-hidden="true"
            >
              {i + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-xs leading-relaxed text-ink-soft">{note}</p>
    </div>
  );
}
