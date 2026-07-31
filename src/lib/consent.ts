// ---------------------------------------------------------------------------
// Advertising consent (compliance audit B-1).
//
// WHAT THIS IS FOR. Article 5(3) of the ePrivacy Directive, implemented in the
// Netherlands as Article 11.7a Telecommunicatiewet, allows storing or reading
// information on a visitor's device only with prior consent, obtained after
// clear information, with a narrow exemption for what is strictly necessary to
// the service the visitor asked for. Advertising is expressly outside that
// exemption. Independently of the cookie question, merely LOADING a third-party
// ad script discloses the visitor's IP address, which is personal data (CJEU
// C-582/14 Breyer), and there is no Article 6 GDPR basis for that disclosure
// other than consent.
//
// So: nothing from an advertiser may load until the visitor has chosen. This
// module is the record of that choice. It is pure and storage-free; the
// component owns the DOM and localStorage.
//
// WHAT THIS IS NOT. It is not an IAB TCF consent management platform. Google's
// EU User Consent Policy separately requires publishers serving personalised ads
// in the EEA and UK to use a Google-CERTIFIED CMP integrated with TCF (audit
// B-2), and no amount of first-party code satisfies that: certification is a
// list you are on. The gate here is what keeps Drift lawful under ePrivacy and
// the GDPR, and it is also the thing a certified CMP would need to drive. See
// docs/owner-actions.md before switching advertising on.
//
// THE AP'S RULES, which are more specific than "obtain consent" and are the ones
// it actually writes letters about:
//   1. Nothing third-party loads before a choice.
//   2. Accept and Reject on the FIRST screen, at equal visual weight. Refusing
//      takes exactly one click, the same as accepting.
//   3. Nothing pre-ticked. Every non-essential purpose defaults to off.
//   4. No cookie wall. Refusing must not cost access.
//   5. Withdrawal as easy as giving, from every page.
//   6. Evidence: Article 7(1) puts the burden of demonstrating consent on us.
// ---------------------------------------------------------------------------

/** The three states. `unset` is the only one in which the banner shows, and the
 *  only one in which nothing third-party may load. */
export type ConsentChoice = "granted" | "denied" | "unset";

/**
 * The version of the ASK. Bump it only when what is being consented to changes:
 * a new recipient, a new purpose, a materially different description. Bumping it
 * re-asks everyone, so a typo fix is not a reason to.
 *
 * Stored with the choice, because "they consented" is not a defensible answer to
 * a regulator without "to this, on this date".
 */
export const CONSENT_VERSION = 1;

/** Where the choice lives. First-party localStorage, not a cookie: the choice
 *  itself is strictly necessary to honour the choice, so it needs no consent,
 *  and a cookie would be sent to the server on every request for no reason. */
export const CONSENT_KEY = "drift.consent.ads";

/** What is written down. Article 7(1) GDPR: the controller must be able to
 *  demonstrate that the data subject consented. */
export interface ConsentRecord {
  choice: Exclude<ConsentChoice, "unset">;
  /** ISO timestamp of the choice. */
  at: string;
  /** Which version of the ask was answered. */
  version: number;
}

/** Parse a stored record. Anything unrecognised reads as `unset`, which means
 *  the banner shows again and nothing loads: the safe direction. */
export function parseConsent(raw: string | null): ConsentRecord | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<ConsentRecord>;
    if (v?.choice !== "granted" && v?.choice !== "denied") return null;
    if (typeof v.at !== "string" || !v.at) return null;
    if (typeof v.version !== "number") return null;
    return { choice: v.choice, at: v.at, version: v.version };
  } catch {
    return null;
  }
}

/**
 * The current choice, given what is stored.
 *
 * A record answering an OLDER version of the ask is treated as `unset`: what the
 * visitor agreed to is not what we would now be doing, and consent does not
 * carry forward across a change in purpose or recipient.
 */
export function consentChoice(record: ConsentRecord | null): ConsentChoice {
  if (!record) return "unset";
  return record.version === CONSENT_VERSION ? record.choice : "unset";
}

/** Build the record to store. `now` is injected so tests do not depend on a clock. */
export function makeConsentRecord(
  choice: Exclude<ConsentChoice, "unset">,
  now: Date = new Date(),
): ConsentRecord {
  return { choice, at: now.toISOString(), version: CONSENT_VERSION };
}

// ---------------------------------------------------------------------------
// Google consent mode v2.
//
// Even with the loader gated, Google wants the signal explicitly, and the
// defaults have to be in place BEFORE any Google tag could run. All four
// default to `denied`, which is both the audit's requirement and the only
// honest default: nothing has been agreed at the point the page loads.
//
// `analytics_storage` is in the list even though Drift runs no analytics, since
// omitting a signal is not the same as denying it.
// ---------------------------------------------------------------------------

export const CONSENT_SIGNALS = [
  "ad_storage",
  "ad_user_data",
  "ad_personalization",
  "analytics_storage",
] as const;

export type ConsentSignal = (typeof CONSENT_SIGNALS)[number];

/** The consent-mode payload for a given choice. */
export function consentModeState(
  choice: ConsentChoice,
): Record<ConsentSignal, "granted" | "denied"> {
  const value = choice === "granted" ? "granted" : "denied";
  return {
    ad_storage: value,
    ad_user_data: value,
    ad_personalization: value,
    analytics_storage: value,
  };
}

/**
 * The inline script that installs `gtag` and sets every signal to denied.
 *
 * It has to run before anything Google, so it is injected as a blocking inline
 * script in the document head rather than from an effect. Kept as a string here
 * so its content is unit-testable: the one thing that must never regress is that
 * the defaults are `denied`.
 */
export function consentModeBootstrap(): string {
  const denied = CONSENT_SIGNALS.map((s) => `${s}:'denied'`).join(",");
  return (
    `window.dataLayer=window.dataLayer||[];` +
    `function gtag(){dataLayer.push(arguments)}` +
    `gtag('consent','default',{${denied},'wait_for_update':500});`
  );
}

// ---------------------------------------------------------------------------
// Age (compliance audit M-8).
//
// GDPR Article 8 applies to information society services offered directly to a
// child and only where consent is the basis. Drift's core processing is Article
// 6(1)(b) contract and Drift is not directed at children, so Article 8 does not
// currently bite. It starts to the moment advertising consent exists, because
// that IS Article 6(1)(a) processing.
//
// The Dutch digital age of consent is 16: the Netherlands did not exercise the
// option in Article 8(1) to lower it, and Article 5 UAVG keeps it there.
// Separately, Article 1:234 BW makes a contract concluded by a minor without
// parental consent voidable, and the Terms are a contract.
//
// Proportionate to a service with 20 to 50 users who are not children: a
// self-declaration, which is what regulators expect from a service not directed
// at children. It is a good-faith measure, not verification, and it is not
// pretending to be one.
//
// DATA MINIMISATION. Only the boolean is kept. A date of birth would be a new
// category of personal data to hold, protect, export and delete, in exchange for
// an answer we do not need (Article 5(1)(c)).
// ---------------------------------------------------------------------------

/** The minimum age to hold an account, in the terms and at sign-up. */
export const MINIMUM_AGE = 16;

/** Where the declaration is recorded for a signed-in user. */
export const AGE_SETTING_KEY = "age16Plus";

/** Whether a sign-up may proceed. Deliberately a function rather than a bare
 *  boolean check, so the rule and its reason live in one place. */
export function mayCreateAccount(declaredAge16Plus: boolean): boolean {
  return declaredAge16Plus === true;
}

/** The message shown when the box is not ticked. States the rule rather than
 *  scolding: someone under 16 is not doing anything wrong by being 15. */
export function ageDeclarationError(): string {
  return `You need to be ${MINIMUM_AGE} or older to create a Drift account.`;
}
