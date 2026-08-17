import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  parseAdsConfig,
  shouldShowAd,
  adsenseReady,
  adsenseScriptEnabled,
  DEFAULT_ADS_EVERY,
} from "./ads";

describe("parseAdsConfig", () => {
  it("is OFF and placeholder by default (empty env)", () => {
    const c = parseAdsConfig({});
    expect(c.enabled).toBe(false);
    expect(c.mode).toBe("placeholder");
    expect(c.every).toBe(DEFAULT_ADS_EVERY);
    expect(c.client).toBeUndefined();
    expect(c.slot).toBeUndefined();
  });

  it("enables only on the exact '1'", () => {
    expect(parseAdsConfig({ NEXT_PUBLIC_ADS_ENABLED: "1" }).enabled).toBe(true);
    expect(parseAdsConfig({ NEXT_PUBLIC_ADS_ENABLED: "0" }).enabled).toBe(false);
    expect(parseAdsConfig({ NEXT_PUBLIC_ADS_ENABLED: "true" }).enabled).toBe(false);
    expect(parseAdsConfig({ NEXT_PUBLIC_ADS_ENABLED: "" }).enabled).toBe(false);
  });

  it("only 'adsense' selects adsense mode; anything else is placeholder", () => {
    expect(parseAdsConfig({ NEXT_PUBLIC_ADS_MODE: "adsense" }).mode).toBe("adsense");
    expect(parseAdsConfig({ NEXT_PUBLIC_ADS_MODE: "placeholder" }).mode).toBe(
      "placeholder",
    );
    expect(parseAdsConfig({ NEXT_PUBLIC_ADS_MODE: "real" }).mode).toBe("placeholder");
  });

  it("parses a valid cadence and falls back on junk / < 1", () => {
    expect(parseAdsConfig({ NEXT_PUBLIC_ADS_EVERY: "3" }).every).toBe(3);
    expect(parseAdsConfig({ NEXT_PUBLIC_ADS_EVERY: "7.9" }).every).toBe(7);
    expect(parseAdsConfig({ NEXT_PUBLIC_ADS_EVERY: "0" }).every).toBe(DEFAULT_ADS_EVERY);
    expect(parseAdsConfig({ NEXT_PUBLIC_ADS_EVERY: "-2" }).every).toBe(
      DEFAULT_ADS_EVERY,
    );
    expect(parseAdsConfig({ NEXT_PUBLIC_ADS_EVERY: "nope" }).every).toBe(
      DEFAULT_ADS_EVERY,
    );
  });

  it("carries the AdSense ids through", () => {
    const c = parseAdsConfig({
      NEXT_PUBLIC_ADSENSE_CLIENT: "ca-pub-123",
      NEXT_PUBLIC_ADSENSE_SLOT: "456",
    });
    expect(c.client).toBe("ca-pub-123");
    expect(c.slot).toBe("456");
  });
});

describe("shouldShowAd", () => {
  it("fires once the count reaches the cadence", () => {
    expect(shouldShowAd(4, 5)).toBe(false);
    expect(shouldShowAd(5, 5)).toBe(true);
    expect(shouldShowAd(6, 5)).toBe(true);
    expect(shouldShowAd(0, 5)).toBe(false);
  });
  it("never fires for a non-positive cadence", () => {
    expect(shouldShowAd(10, 0)).toBe(false);
  });
});

describe("adsenseScriptEnabled", () => {
  // The regression this pins is compliance audit B-1. A publisher id ALONE used
  // to load the script, which meant production served adsbygoogle.js and Google's
  // Funding Choices endpoint, and wrote an FCCDCF cookie, to every logged-out EEA
  // visitor with no consent mechanism and with ads switched off. One switch now
  // governs all of it.
  it("needs the kill switch, not just a publisher id", () => {
    const idOnly = parseAdsConfig({ NEXT_PUBLIC_ADSENSE_CLIENT: "ca-pub-1" });
    expect(adsenseScriptEnabled(idOnly), "id alone must NOT load anything").toBe(
      false,
    );
    expect(adsenseReady(idOnly)).toBe(false);
  });

  it("loads once the switch is on and a publisher id is set", () => {
    expect(
      adsenseScriptEnabled(
        parseAdsConfig({
          NEXT_PUBLIC_ADS_ENABLED: "1",
          NEXT_PUBLIC_ADSENSE_CLIENT: "ca-pub-1",
        }),
      ),
    ).toBe(true);
  });

  it("does not load without a client id", () => {
    expect(adsenseScriptEnabled(parseAdsConfig({}))).toBe(false);
    expect(
      adsenseScriptEnabled(parseAdsConfig({ NEXT_PUBLIC_ADS_ENABLED: "1" })),
    ).toBe(false);
  });

  // The property that actually matters, stated directly: with the switch off,
  // there is no configuration of the other variables that puts Google on the page.
  it("is off for EVERY config with the kill switch off", () => {
    for (const client of [undefined, "ca-pub-1"]) {
      for (const slot of [undefined, "slot-1"]) {
        for (const mode of [undefined, "adsense", "placeholder"]) {
          const cfg = parseAdsConfig({
            NEXT_PUBLIC_ADSENSE_CLIENT: client,
            NEXT_PUBLIC_ADSENSE_SLOT: slot,
            NEXT_PUBLIC_ADS_MODE: mode,
          });
          expect(
            adsenseScriptEnabled(cfg),
            `client=${client} slot=${slot} mode=${mode}`,
          ).toBe(false);
          expect(adsenseReady(cfg)).toBe(false);
        }
      }
    }
  });
});

describe("adsenseReady", () => {
  it("needs enabled + adsense mode + both ids", () => {
    const base = { enabled: true, mode: "adsense" as const, every: 5 };
    expect(adsenseReady({ ...base, client: "ca-pub-1", slot: "2" })).toBe(true);
    expect(adsenseReady({ ...base, client: "ca-pub-1" })).toBe(false); // no slot
    expect(adsenseReady({ ...base })).toBe(false); // no ids
    expect(
      adsenseReady({
        enabled: true,
        mode: "placeholder",
        every: 5,
        client: "ca-pub-1",
        slot: "2",
      }),
    ).toBe(false); // placeholder
    expect(
      adsenseReady({ enabled: false, mode: "adsense", every: 5, client: "ca-pub-1", slot: "2" }),
    ).toBe(false); // disabled
  });
});

// ---------------------------------------------------------------------------
// public/ads.txt — the one Google signal that is NOT behind the kill switch.
//
// AdSense verifies domain ownership by any one of three interchangeable signals:
// the loader snippet, the `google-adsense-account` meta tag, or this file. The
// first two require NEXT_PUBLIC_ADS_ENABLED and are therefore absent by design,
// so with ads off this file is the ONLY thing telling Google the domain is ours.
//
// It was deleted once while ads were off (compliance audit Mi-6) and the site
// then sat in "Getting ready" with "Ads.txt status: Not found" for a week, which
// nothing in the code could have caught: it is a static asset, so no build, lint
// or type check has an opinion about whether it exists. Hence this test. It reads
// the real file, the way contrast.test.ts reads the real stylesheet.
//
// Google's parser is strict about the record shape and forgiving about nothing,
// so the assertions are on the exact four fields rather than a loose match.
// ---------------------------------------------------------------------------
describe("public/ads.txt", () => {
  const file = join(process.cwd(), "public", "ads.txt");
  const raw = existsSync(file) ? readFileSync(file, "utf8") : "";

  it("exists", () => {
    // Spelled out, because the useful thing to know at 2am is not "ENOENT" but
    // what deleting it costs: AdSense stops being able to verify the domain.
    expect(
      existsSync(file),
      `${file} is missing. With NEXT_PUBLIC_ADS_ENABLED off this file is the only\n` +
        `signal AdSense can use to verify we own the domain, so removing it stalls\n` +
        `site review at "Getting ready" / "Ads.txt status: Not found". See lib/ads.ts.`,
    ).toBe(true);
  });

  it("has no BOM and ends with a newline", () => {
    // A UTF-8 BOM lands in the first field and makes the domain unrecognisable;
    // a missing final newline is the single most reported cause of a record that
    // exists but never validates.
    expect(raw.charCodeAt(0)).not.toBe(0xfeff);
    expect(raw.endsWith("\n")).toBe(true);
  });

  it("declares Google as a DIRECT seller with a well-formed publisher id", () => {
    const records = raw
      .split("\n")
      .map((l) => l.split("#")[0].trim()) // `#` starts a comment (IAB spec)
      .filter(Boolean);

    const google = records.find((l) => l.startsWith("google.com,"));
    expect(google, `no google.com record in:\n${raw}`).toBeDefined();

    const [domain, publisher, relationship, authority] = google!
      .split(",")
      .map((f) => f.trim());
    expect(domain).toBe("google.com");
    // 16 digits after `pub-`, and NOT the `ca-pub-` form used by the ad tag:
    // ads.txt takes the bare id and Google reads `ca-pub-…` as a different one.
    expect(publisher).toMatch(/^pub-\d{16}$/);
    expect(relationship).toBe("DIRECT");
    // Google's certification authority id. A wrong or missing value here is what
    // turns the status into "Unauthorized" rather than "Authorized".
    expect(authority).toBe("f08c47fec0942fa0");
  });
});
