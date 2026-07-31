import { describe, it, expect } from "vitest";
import {
  CONSENT_VERSION,
  CONSENT_SIGNALS,
  consentChoice,
  consentModeBootstrap,
  consentModeState,
  makeConsentRecord,
  parseConsent,
  MINIMUM_AGE,
  mayCreateAccount,
  ageDeclarationError,
} from "./consent";

const AT = new Date("2026-07-31T10:00:00.000Z");

describe("the stored consent record", () => {
  it("round-trips a choice with its timestamp and version", () => {
    const rec = makeConsentRecord("granted", AT);
    expect(rec).toEqual({
      choice: "granted",
      at: "2026-07-31T10:00:00.000Z",
      version: CONSENT_VERSION,
    });
    expect(parseConsent(JSON.stringify(rec))).toEqual(rec);
  });

  // Article 7(1) GDPR puts the burden of DEMONSTRATING consent on the
  // controller. "They consented" is not an answer without "to this, on this
  // date", so a record missing either is not a record.
  it("refuses a record missing the evidence", () => {
    for (const bad of [
      JSON.stringify({ choice: "granted" }),
      JSON.stringify({ choice: "granted", at: "" , version: 1 }),
      JSON.stringify({ choice: "granted", at: "2026-01-01" }),
      JSON.stringify({ at: "2026-01-01", version: 1 }),
    ]) {
      expect(parseConsent(bad), bad).toBeNull();
    }
  });

  it("reads anything unrecognised as nothing at all", () => {
    for (const bad of [null, "", "not json", "[]", JSON.stringify({ choice: "maybe" })]) {
      expect(parseConsent(bad as string | null), String(bad)).toBeNull();
    }
  });
});

describe("consentChoice", () => {
  it("is unset when nothing has been stored, so nothing may load", () => {
    expect(consentChoice(null)).toBe("unset");
  });

  it("reports a current choice", () => {
    expect(consentChoice(makeConsentRecord("granted", AT))).toBe("granted");
    expect(consentChoice(makeConsentRecord("denied", AT))).toBe("denied");
  });

  // Consent does not carry forward across a change in purpose or recipient:
  // what they agreed to would not be what we were doing.
  it("re-asks when the ask has changed version", () => {
    const stale = { ...makeConsentRecord("granted", AT), version: CONSENT_VERSION - 1 };
    expect(consentChoice(stale)).toBe("unset");
  });
});

describe("Google consent mode v2", () => {
  it("covers all four signals the audit lists", () => {
    expect([...CONSENT_SIGNALS]).toEqual([
      "ad_storage",
      "ad_user_data",
      "ad_personalization",
      "analytics_storage",
    ]);
  });

  it("denies everything until a choice is made", () => {
    for (const choice of ["unset", "denied"] as const) {
      const state = consentModeState(choice);
      for (const signal of CONSENT_SIGNALS) {
        expect(state[signal], `${choice}/${signal}`).toBe("denied");
      }
    }
  });

  it("grants everything only on an explicit grant", () => {
    const state = consentModeState("granted");
    for (const signal of CONSENT_SIGNALS) expect(state[signal]).toBe("granted");
  });

  // The head bootstrap is the one thing that must never regress: it runs before
  // anything Google could, and its whole job is to say "no" first.
  it("bootstraps every signal as denied, never granted", () => {
    const js = consentModeBootstrap();
    for (const signal of CONSENT_SIGNALS) {
      expect(js).toContain(`${signal}:'denied'`);
    }
    expect(js).not.toContain("'granted'");
    expect(js).toContain("gtag('consent','default'");
  });
});

// GDPR Article 8 applies where consent is the basis, and the Dutch digital age
// of consent is 16 (Article 5 UAVG; the Netherlands did not exercise the Article
// 8(1) option to lower it). Article 1:234 BW separately makes a minor's contract
// voidable, and the terms are a contract.
describe("the age declaration", () => {
  it("is 16, the Dutch digital age of consent", () => {
    expect(MINIMUM_AGE).toBe(16);
  });

  it("admits only an affirmative declaration", () => {
    expect(mayCreateAccount(true)).toBe(true);
    expect(mayCreateAccount(false)).toBe(false);
    // Guards the "an unticked box is falsy enough" shortcut.
    expect(mayCreateAccount(undefined as unknown as boolean)).toBe(false);
    expect(mayCreateAccount(null as unknown as boolean)).toBe(false);
  });

  it("states the rule without scolding, and names the age", () => {
    const msg = ageDeclarationError();
    expect(msg).toContain(String(MINIMUM_AGE));
    expect(msg).not.toMatch(/[—–]/);
  });
});
