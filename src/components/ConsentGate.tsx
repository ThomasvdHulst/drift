"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import Script from "next/script";
import Link from "next/link";
import { adsConfig, adsenseScriptEnabled } from "@/lib/ads";
import {
  CONSENT_KEY,
  consentChoice,
  consentModeState,
  makeConsentRecord,
  parseConsent,
  type ConsentChoice,
} from "@/lib/consent";

// ---------------------------------------------------------------------------
// The consent gate (compliance audit B-1). Everything advertising-related on the
// client lives here: the stored choice, the banner that asks for it, the footer
// link that reopens it, and the AdSense loader that may only run once it says
// "granted".
//
// THE ONE INVARIANT. `AdSenseLoader` renders the Google script if and only if
// `adsenseScriptEnabled(config)` AND the stored choice is `granted`. Both. There
// is no other path to a third-party request in this app, which is what makes the
// claim on /privacy checkable rather than aspirational.
//
// It is all inert when the ads switch is off, which is its state today: the
// provider reports "unset", the banner returns null, the footer link returns
// null, and the loader returns null. Off means genuinely nothing, the same
// property M0 established.
//
// NOT A CERTIFIED CMP. Google separately requires a Google-certified IAB TCF
// v2.2 consent management platform for personalised ads in the EEA and UK
// (audit B-2). This gate is what makes Drift lawful under ePrivacy and the
// GDPR; it does not make Drift eligible for personalised ads. Read
// docs/owner-actions.md before setting NEXT_PUBLIC_ADS_ENABLED=1.
// ---------------------------------------------------------------------------

interface ConsentApi {
  /** "unset" until a choice is made, and while ads are switched off. */
  choice: ConsentChoice;
  /** Whether the ads switch is on at all. Everything is inert when it is not. */
  adsConfigured: boolean;
  /** Whether the first-layer banner should be on screen. */
  asking: boolean;
  grant: () => void;
  deny: () => void;
  /** Reopen the choice from the footer. Withdrawal has to be as easy as giving. */
  reopen: () => void;
}

const Ctx = createContext<ConsentApi>({
  choice: "unset",
  adsConfigured: false,
  asking: false,
  grant: () => {},
  deny: () => {},
  reopen: () => {},
});

export function useConsent(): ConsentApi {
  return useContext(Ctx);
}

/** Tell Google what was decided. A no-op until something has installed `gtag`,
 *  which the head bootstrap does only when ads are configured. */
function pushConsentUpdate(choice: ConsentChoice) {
  const w = window as unknown as { gtag?: (...args: unknown[]) => void };
  try {
    w.gtag?.("consent", "update", consentModeState(choice));
  } catch {
    /* the gate is the loader condition; the signal is belt and braces */
  }
}

export function ConsentProvider({ children }: { children: ReactNode }) {
  const adsConfigured = adsenseScriptEnabled(adsConfig());
  // `null` means "not read yet", which is distinct from "unset". Both keep the
  // loader off, but only "unset" shows the banner: flashing it at someone who
  // already chose would be its own kind of dark pattern.
  const [stored, setStored] = useState<ConsentChoice | null>(null);
  const [reopened, setReopened] = useState(false);
  const choice: ConsentChoice = stored ?? "unset";

  useEffect(() => {
    if (!adsConfigured) return;
    let read: ConsentChoice = "unset";
    try {
      read = consentChoice(parseConsent(localStorage.getItem(CONSENT_KEY)));
    } catch {
      /* storage unavailable: stays "unset", so nothing loads */
    }
    // Deferred off the effect body (React 19 forbids a synchronous setState
    // there), the same pattern the rest of the app uses.
    queueMicrotask(() => setStored(read));
  }, [adsConfigured]);

  const decide = useCallback((next: "granted" | "denied") => {
    setStored(next);
    setReopened(false);
    try {
      localStorage.setItem(CONSENT_KEY, JSON.stringify(makeConsentRecord(next)));
    } catch {
      /* a choice we cannot store is honoured for this page and asked again */
    }
    pushConsentUpdate(next);
    // Withdrawal must actually stop the processing, not just record a
    // preference. Nothing Google set can be removed from here (its cookies are
    // third-party and on its own domain), so a withdrawal reloads: the loader
    // then never mounts and no further request is made.
    if (next === "denied") window.location.reload();
  }, []);

  const api = useMemo<ConsentApi>(
    () => ({
      choice,
      adsConfigured,
      asking: adsConfigured && stored !== null && (stored === "unset" || reopened),
      grant: () => decide("granted"),
      deny: () => decide("denied"),
      reopen: () => setReopened(true),
    }),
    [choice, adsConfigured, stored, reopened, decide],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

/**
 * The AdSense loader. The single place a Google script can enter the page.
 *
 * Both conditions, always: the switch and the choice.
 */
export function AdSenseLoader() {
  const { choice, adsConfigured } = useConsent();
  const cfg = adsConfig();
  if (!adsConfigured || choice !== "granted") return null;
  return (
    <Script
      id="adsbygoogle-init"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${cfg.client}`}
      strategy="afterInteractive"
      crossOrigin="anonymous"
    />
  );
}

/**
 * The first layer.
 *
 * Both choices are on this screen, in identical buttons: same size, same
 * padding, same font weight, same border, same colours. Refusing is one click
 * and so is accepting. That equality is the AP's published `vuistregels`
 * standard and is the single most common thing it writes letters about, so it is
 * expressed as ONE shared class string rather than two that could drift apart.
 *
 * It is not a cookie wall: it does not trap focus, does not cover the page, and
 * refusing costs nothing. Nothing is pre-selected, because there is nothing to
 * pre-select: there are no toggles, since there is exactly one purpose to decide.
 */
const CHOICE_BUTTON =
  "flex-1 rounded-full border border-line-strong bg-paper px-5 py-2.5 text-sm font-medium text-ink transition hover:border-accent/60 hover:text-accent-strong focus-ring";

export function ConsentBanner() {
  const { asking, grant, deny } = useConsent();
  if (!asking) return null;
  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="consent-title"
      className="fixed inset-x-0 bottom-0 z-40 p-3 sm:p-4"
    >
      <div className="mx-auto max-w-xl rounded-2xl border border-line bg-paper-raised p-5 shadow-lg">
        <h2 id="consent-title" className="font-serif text-lg text-ink">
          Advertising on Drift
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          Drift would like to show advertising from Google to help keep it free.
          That means loading Google&apos;s code, which receives your IP address
          and may store things on your device. Nothing from Google has loaded
          yet, and nothing will unless you say yes. Drift itself runs no
          tracking and no analytics either way, and saying no costs you nothing.{" "}
          <Link
            href="/privacy"
            className="text-accent-strong underline-offset-2 hover:underline"
          >
            What Drift stores
          </Link>
          .
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={deny} className={CHOICE_BUTTON}>
            Reject all
          </button>
          <button type="button" onClick={grant} className={CHOICE_BUTTON}>
            Accept all
          </button>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-ink-soft">
          You can change this at any time from &ldquo;Cookie settings&rdquo; at
          the bottom of any page.
        </p>
      </div>
    </div>
  );
}

/**
 * The persistent way back in. Withdrawal has to be as easy as giving it, from
 * every page, which is why this sits in the same footer row as the other
 * small-print links rather than behind a settings screen.
 *
 * Renders nothing when the ads switch is off, so the footer does not offer to
 * manage a choice that does not exist.
 */
export function CookieSettingsLink({ className }: { className?: string }) {
  const { adsConfigured, reopen } = useConsent();
  if (!adsConfigured) return null;
  return (
    <button type="button" onClick={reopen} className={className}>
      Cookie settings
    </button>
  );
}
