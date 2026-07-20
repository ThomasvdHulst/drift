import { describe, it, expect } from "vitest";
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
  it("loads on just a client id (for review), independent of the kill switch", () => {
    expect(
      adsenseScriptEnabled(parseAdsConfig({ NEXT_PUBLIC_ADSENSE_CLIENT: "ca-pub-1" })),
    ).toBe(true);
    // review state: client set, ads still off -> script loads, no visible ad
    const reviewCfg = parseAdsConfig({ NEXT_PUBLIC_ADSENSE_CLIENT: "ca-pub-1" });
    expect(adsenseScriptEnabled(reviewCfg)).toBe(true);
    expect(adsenseReady(reviewCfg)).toBe(false);
  });
  it("does not load without a client id", () => {
    expect(adsenseScriptEnabled(parseAdsConfig({}))).toBe(false);
    expect(
      adsenseScriptEnabled(parseAdsConfig({ NEXT_PUBLIC_ADS_ENABLED: "1" })),
    ).toBe(false);
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
