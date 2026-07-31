// Ads configuration (Phase 21). Ads are an OFF-by-default, killable experiment
// (see plan.md Phase 21). This module is the single source of truth for whether
// ads run, in which mode, and how often. Pure + injectable so it's unit-testable,
// mirroring `parseOAuthProviders` in lib/auth.ts. When disabled, nothing here
// causes a script, a card, or a cookie — the app is byte-for-byte the ad-free app.
//
// NOTE: Next.js only inlines `process.env.NEXT_PUBLIC_*` for the browser when it's
// a STATIC member access. So `adsConfig()` reads each var literally and hands a
// plain object to `parseAdsConfig` (which tests can call with any object).

export type AdsMode = "placeholder" | "adsense";

export interface AdsConfig {
  enabled: boolean;
  mode: AdsMode;
  every: number; // show one ad after this many drift-scrolls
  client?: string; // AdSense publisher id (ca-pub-...), adsense mode only
  slot?: string; // AdSense ad-unit slot id, adsense mode only
}

type AdsEnv = {
  NEXT_PUBLIC_ADS_ENABLED?: string;
  NEXT_PUBLIC_ADS_MODE?: string;
  NEXT_PUBLIC_ADS_EVERY?: string;
  NEXT_PUBLIC_ADSENSE_CLIENT?: string;
  NEXT_PUBLIC_ADSENSE_SLOT?: string;
};

export const DEFAULT_ADS_EVERY = 5;

/** Parse the ads config from an env-shaped object (pure; injectable for tests). */
export function parseAdsConfig(env: AdsEnv): AdsConfig {
  const enabled = env.NEXT_PUBLIC_ADS_ENABLED === "1";
  const mode: AdsMode =
    env.NEXT_PUBLIC_ADS_MODE === "adsense" ? "adsense" : "placeholder";
  const n = Number(env.NEXT_PUBLIC_ADS_EVERY);
  const every = Number.isFinite(n) && n >= 1 ? Math.floor(n) : DEFAULT_ADS_EVERY;
  const client = env.NEXT_PUBLIC_ADSENSE_CLIENT || undefined;
  const slot = env.NEXT_PUBLIC_ADSENSE_SLOT || undefined;
  return { enabled, mode, every, client, slot };
}

/** The live config, read from statically-inlined NEXT_PUBLIC_* vars. */
export function adsConfig(): AdsConfig {
  return parseAdsConfig({
    NEXT_PUBLIC_ADS_ENABLED: process.env.NEXT_PUBLIC_ADS_ENABLED,
    NEXT_PUBLIC_ADS_MODE: process.env.NEXT_PUBLIC_ADS_MODE,
    NEXT_PUBLIC_ADS_EVERY: process.env.NEXT_PUBLIC_ADS_EVERY,
    NEXT_PUBLIC_ADSENSE_CLIENT: process.env.NEXT_PUBLIC_ADSENSE_CLIENT,
    NEXT_PUBLIC_ADSENSE_SLOT: process.env.NEXT_PUBLIC_ADSENSE_SLOT,
  });
}

/** Whether an ad is due, given how many drift-scrolls happened since the last. */
export function shouldShowAd(driftsSinceAd: number, every: number): boolean {
  return every >= 1 && driftsSinceAd >= every;
}

/**
 * Whether ANY Google advertising code may reach the page: the loader script, the
 * ownership meta tag, and the consent gate that has to precede them.
 *
 * This requires the kill switch, not just a publisher id. It used to require only
 * the id, on the reasoning that the script had to be live for Google to review the
 * site while visible ads stayed off. That reasoning was wrong in a way that cost
 * us: with a publisher id configured and ads switched off, production was serving
 * `adsbygoogle.js` AND `fundingchoicesmessages.google.com` to every visitor,
 * including logged-out EEA visitors, and writing an `FCCDCF` cookie, with no
 * consent mechanism anywhere (compliance audit B-1, verified live 2026-07-31).
 * Drift was carrying the entire legal exposure of an ad-funded site while earning
 * nothing, because the AdSense application had been refused.
 *
 * So there is now ONE switch. `NEXT_PUBLIC_ADS_ENABLED` decides whether any of it
 * exists: the script, the meta tag, the consent gate, and the wording on /privacy
 * and /faq that describes them. Off means no third-party request and no cookie,
 * and the copy that says so is true. On means the consent gate runs first and
 * nothing third-party loads before a choice.
 *
 * Ownership verification is not a reason to weaken this. AdSense also verifies via
 * `ads.txt` and via a site-level review that only needs the site reachable.
 */
export function adsenseScriptEnabled(cfg: AdsConfig): boolean {
  return cfg.enabled && !!cfg.client;
}

/** Whether a real AdSense ad unit should actually render (kill switch on + adsense
 *  mode + both ids). The visible in-feed interstitial only appears when this holds. */
export function adsenseReady(cfg: AdsConfig): boolean {
  return cfg.enabled && cfg.mode === "adsense" && !!cfg.client && !!cfg.slot;
}
