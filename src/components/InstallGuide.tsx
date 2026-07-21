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
