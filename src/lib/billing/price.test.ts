import { describe, it, expect } from "vitest";
import {
  breakdown,
  formatEur,
  amountLooksRight,
  splitFromStripe,
  rateFromAmounts,
  describeVat,
  isEuCountry,
  PRICE_CENTS,
  VAT_RATE_BPS,
} from "./price";

describe("breakdown", () => {
  it("splits €7.00 into €5.79 + €1.21 of Dutch VAT", () => {
    // The numbers quoted to the owner and printed on the receipt. If this test
    // ever changes, the receipt is wrong and so is a tax return.
    expect(breakdown()).toEqual({
      grossCents: 700,
      netCents: 579,
      vatCents: 121,
      ratePct: 21,
    });
  });

  it("always adds back to exactly the gross, at every price up to €100", () => {
    // The property that actually matters: a rounding rule that loses a cent
    // somewhere is a bookkeeping error, not a display quirk.
    for (let gross = 0; gross <= 10_000; gross++) {
      const b = breakdown(gross, VAT_RATE_BPS);
      expect(b.netCents + b.vatCents).toBe(gross);
      expect(Number.isInteger(b.vatCents)).toBe(true);
    }
  });

  it("handles a zero-rated sale (a buyer outside the EU, Stripe Tax on)", () => {
    expect(breakdown(579, 0)).toEqual({
      grossCents: 579,
      netCents: 579,
      vatCents: 0,
      ratePct: 0,
    });
  });

  it("handles other rates, for the day the price or the country changes", () => {
    expect(breakdown(121, 2100).vatCents).toBe(21);
    expect(breakdown(109, 900).vatCents).toBe(9); // NL reduced rate
  });
});

describe("formatEur", () => {
  it("always shows two decimals", () => {
    expect(formatEur(700)).toBe("€7.00");
    expect(formatEur(579)).toBe("€5.79");
    expect(formatEur(121)).toBe("€1.21");
    expect(formatEur(0)).toBe("€0.00");
    expect(formatEur(5)).toBe("€0.05");
    expect(formatEur(1050)).toBe("€10.50");
  });

  it("keeps a refund readable", () => {
    expect(formatEur(-700)).toBe("-€7.00");
  });
});

describe("amountLooksRight", () => {
  it("accepts the advertised gross and the zero-rated net", () => {
    expect(amountLooksRight(PRICE_CENTS)).toBe(true);
    expect(amountLooksRight(579)).toBe(true); // non-EU buyer, no Dutch VAT
  });

  it("flags anything else", () => {
    expect(amountLooksRight(100)).toBe(false);
    expect(amountLooksRight(null)).toBe(false);
    expect(amountLooksRight(undefined)).toBe(false);
  });
});

describe("splitFromStripe", () => {
  it("uses Stripe's tax figure rather than re-deriving it", () => {
    expect(splitFromStripe(700, 121)).toEqual({
      grossCents: 700,
      vatCents: 121,
      netCents: 579,
      ratePct: 21,
    });
  });

  it("reports a zero-rated sale honestly (a buyer outside the EU)", () => {
    // The case this function exists for. Printing "includes 21% BTW" on a
    // receipt for someone who was charged no BTW is a wrong tax document.
    expect(splitFromStripe(579, 0)).toEqual({
      grossCents: 579,
      vatCents: 0,
      netCents: 579,
      ratePct: 0,
    });
  });

  it("falls back to the advertised split when no tax figure came through", () => {
    expect(splitFromStripe(700, undefined)).toEqual(breakdown(700));
    expect(splitFromStripe(undefined, undefined)).toEqual(breakdown());
  });

  it("never produces a negative or over-large tax from a nonsense figure", () => {
    expect(splitFromStripe(700, -50).vatCents).toBe(0);
    expect(splitFromStripe(700, 9999).vatCents).toBe(700);
    expect(splitFromStripe(700, 9999).netCents).toBe(0);
  });

  it("rounds the rate to the whole percent it legally is", () => {
    // 121/579 is 20.898%, and the Dutch rate is 21%.
    expect(rateFromAmounts(579, 121)).toBe(21);
    expect(rateFromAmounts(579, 0)).toBe(0);
    expect(rateFromAmounts(0, 0)).toBe(0);
  });
});

describe("describeVat — what a zero tax line is allowed to claim", () => {
  it("states the tax plainly when there was one", () => {
    const d = describeVat(121, 21, "NL");
    expect(d.kind).toBe("charged");
    expect(d.line).toContain("€1.21");
    expect(d.line).toContain("21%");
  });

  it("explains a zero for a buyer outside the EU, which is correct", () => {
    expect(describeVat(0, 0, "US").kind).toBe("outside-eu");
    expect(describeVat(0, 0, "GB").line).toMatch(/outside the EU/);
  });

  it("REFUSES to claim 'outside the EU' for an EU buyer with no tax", () => {
    // This is the case that was quietly wrong: Stripe Tax unactivated means
    // amount_tax is 0 for everybody, and a Dutch buyer would have been told
    // their purchase was supplied outside the EU. The seller still owes that
    // BTW, so the receipt must not explain it away.
    const d = describeVat(0, 0, "NL");
    expect(d.kind).toBe("missing");
    expect(d.line).not.toMatch(/outside the EU/);
    expect(d.line).toMatch(/not itemised/);
  });

  it("treats an unknown country as suspect rather than as foreign", () => {
    expect(describeVat(0, 0, undefined).kind).toBe("missing");
    expect(describeVat(0, 0, "").kind).toBe("missing");
  });

  it("knows the EU membership it needs to", () => {
    for (const c of ["NL", "nl", "DE", "IE", "FR", "PT"]) expect(isEuCountry(c)).toBe(true);
    for (const c of ["GB", "US", "CH", "NO", "AU", undefined, null]) expect(isEuCountry(c)).toBe(false);
  });
});
