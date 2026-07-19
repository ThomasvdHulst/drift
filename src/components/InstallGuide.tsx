"use client";

import { useEffect, useState } from "react";

// Small client helpers for the /install guide. The page itself is a static server
// component; these add the bits that need the browser: a graceful screenshot that
// falls back to a labelled placeholder until the real image is added, an "already
// installed" note, and a gentle "you're on iOS/Android" hint.

// A phone screenshot that degrades to a clean, labelled placeholder (showing the
// exact file path to drop in) until the image exists. So the page looks finished
// both before and after the screenshots are added.
export function InstallShot({
  src,
  alt,
  caption,
}: {
  src: string;
  alt: string;
  caption: string;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <figure className="flex w-full max-w-[200px] flex-col items-center">
      {failed ? (
        <div className="flex aspect-[9/17] w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line bg-paper px-4 text-center">
          <span className="text-xs font-medium uppercase tracking-wide text-ink-soft">
            Screenshot
          </span>
          <code className="break-all text-[11px] leading-tight text-ink-soft/80">
            {src}
          </code>
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          onError={() => setFailed(true)}
          className="w-full rounded-2xl border border-line shadow-sm"
        />
      )}
      <figcaption className="mt-2 text-center text-xs leading-relaxed text-ink-soft">
        {caption}
      </figcaption>
    </figure>
  );
}

// A calm note shown only when the page is already open as an installed app.
export function StandaloneNote() {
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    queueMicrotask(() => {
      try {
        const standalone =
          window.matchMedia?.("(display-mode: standalone)")?.matches ||
          (window.navigator as { standalone?: boolean }).standalone === true;
        if (standalone) setInstalled(true);
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

// A one-line "here's the section for your device" nudge. Renders nothing until the
// platform is known (avoids any hydration mismatch), and nothing on desktop.
export function PlatformHint() {
  const [platform, setPlatform] = useState<"ios" | "android" | null>(null);
  useEffect(() => {
    queueMicrotask(() => {
      try {
        const ua = window.navigator.userAgent || "";
        const iOS =
          /iPad|iPhone|iPod/.test(ua) ||
          // iPadOS 13+ reports as Mac; detect the touch Mac case.
          (ua.includes("Macintosh") && "ontouchend" in window);
        if (iOS) setPlatform("ios");
        else if (/Android/.test(ua)) setPlatform("android");
      } catch {
        // ignore
      }
    });
  }, []);
  if (!platform) return null;
  return (
    <p className="text-sm text-ink-soft">
      It looks like you are on {platform === "ios" ? "an iPhone or iPad" : "Android"}.
      Follow the {platform === "ios" ? "Safari" : "Chrome"} steps below.
    </p>
  );
}
