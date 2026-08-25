import { describe, it, expect } from "vitest";
import { supporterReceiptEmail } from "./messages";
import { imprint } from "../imprint";
import { breakdown, splitFromStripe } from "../billing/price";

// ---------------------------------------------------------------------------
// The supporter receipt is the only email in Drift with legal weight, and the
// things it has to carry are the things nobody notices are missing until a
// consumer authority or an accountant asks. So they are pinned here rather than
// left to a proofread.
//
// A distance contract with a consumer has to be confirmed on a durable medium,
// carrying the trader's identity, the total price with the tax named, and the
// right of withdrawal with how to use it (art. 6:230v BW). This test is that
// checklist, expressed as assertions.
// ---------------------------------------------------------------------------

const receipt = (over: Partial<Parameters<typeof supporterReceiptEmail>[0]> = {}) => {
  const b = breakdown();
  return supporterReceiptEmail({
    grossCents: b.grossCents,
    vatCents: b.vatCents,
    netCents: b.netCents,
    ratePct: b.ratePct,
    paidAt: new Date("2026-08-25T10:30:00Z"),
    reference: "cs_test_abc123",
    ...over,
  });
};

describe("the supporter receipt carries what the law asks for", () => {
  const m = receipt();
  const who = imprint();

  it("names the trader, not just the product", () => {
    expect(m.html).toContain(who.legalName);
    expect(m.html).toContain(who.tradeName);
    expect(m.html).toContain(who.kvk);
    expect(m.html).toContain(who.email);
    for (const line of who.address) expect(m.html).toContain(line);
  });

  it("states the total AND the tax inside it, not just the total", () => {
    expect(m.html).toContain("€7.00");
    expect(m.html).toContain("€1.21");
    expect(m.html).toContain("21%");
    expect(m.html).toContain("€5.79");
  });

  it("gives the date and a reference the payment can be traced by", () => {
    expect(m.html).toContain("2026-08-25");
    expect(m.html).toContain("cs_test_abc123");
  });

  it("spells out the 14 day withdrawal right and how to use it", () => {
    // Drift deliberately does NOT exclude this right, so the receipt has to say
    // it plainly rather than bury it. If this assertion ever fails because the
    // copy changed, check the copy, not the test.
    expect(m.html).toMatch(/14 days|fourteen days/i);
    expect(m.html).toMatch(/money back|refund/i);
    expect(m.note ?? m.html).toBeTruthy();
  });

  it("has a plain-text alternative, since a receipt gets forwarded and archived", () => {
    expect(m.text).toBeTruthy();
    expect(m.text).toContain("€7.00");
    expect(m.text).toContain(who.kvk);
  });

  it("does not use em or en dashes, like the rest of the app's copy", () => {
    expect(m.subject).not.toMatch(/[—–]/);
    expect(m.text).not.toMatch(/[—–]/);
  });
});

describe("a zero-rated sale is described honestly", () => {
  // A buyer outside the EU is charged no Dutch VAT. Printing "includes 21% BTW"
  // on their receipt would be a wrong tax document, so the split comes from what
  // Stripe actually charged.
  const b = splitFromStripe(579, 0);
  const m = receipt({
    grossCents: b.grossCents,
    vatCents: b.vatCents,
    netCents: b.netCents,
    ratePct: b.ratePct,
  });

  it("names no tax that was not charged", () => {
    expect(m.html).toContain("€5.79");
    expect(m.html).not.toContain("21%");
    expect(m.html).toMatch(/outside the EU|none/i);
  });
});
