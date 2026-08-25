// ---------------------------------------------------------------------------
// What the supporter unlock costs, and how that number splits (Phase 32).
//
// ALWAYS IN CENTS, NEVER IN EUROS. Every amount here is an integer number of
// cents, because 0.1 + 0.2 !== 0.3 and this is somebody's money. Stripe works in
// the same unit for the same reason.
//
// ⚠️ THE PRICE LIVES IN TWO PLACES AND THEY HAVE TO AGREE: this constant, and
// the Price object in the Stripe dashboard that `STRIPE_PRICE_ID` points at.
// Stripe owns what is actually charged; this constant owns what the page and the
// receipt SAY. Change one and you must change the other (docs/supporter.md).
// The webhook logs loudly when a completed session's total does not match, which
// is the cheapest way to notice the day they drift apart.
// ---------------------------------------------------------------------------

/** €7.00, inclusive of Dutch VAT. */
export const PRICE_CENTS = 700;

/** Dutch standard rate, in basis points, so the arithmetic stays integral. */
export const VAT_RATE_BPS = 2100;

export const CURRENCY = "eur";

export interface PriceBreakdown {
  /** What the buyer pays. */
  grossCents: number;
  /** What the seller keeps before Stripe's fee. */
  netCents: number;
  /** The tax inside the gross. */
  vatCents: number;
  /** The rate as a percentage, for copy ("includes 21% BTW"). */
  ratePct: number;
}

/**
 * Split a TAX-INCLUSIVE amount.
 *
 * Consumer prices in the Netherlands are shown inclusive, so €7.00 is the whole
 * of what anyone pays and the VAT is inside it. The tax is computed first and
 * the net is the remainder, which is the conventional order and the one that
 * guarantees the two parts add back to exactly the gross. Doing it the other way
 * (round the net, then derive the tax) can leave a cent unaccounted for.
 */
export function breakdown(
  grossCents: number = PRICE_CENTS,
  rateBps: number = VAT_RATE_BPS,
): PriceBreakdown {
  const vatCents = Math.round((grossCents * rateBps) / (10_000 + rateBps));
  return {
    grossCents,
    vatCents,
    netCents: grossCents - vatCents,
    ratePct: rateBps / 100,
  };
}

/** `700` → `"€7.00"`. Fixed two decimals: money with one decimal reads wrong. */
export function formatEur(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.round(cents));
  return `${sign}€${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/**
 * Whether a completed payment matches what we advertise.
 *
 * Used ONLY to log a mismatch, never to refuse a grant. A legitimate purchase
 * can differ for a good reason: with Stripe Tax on, a buyer outside the EU is
 * correctly charged the net amount with no Dutch VAT, and the owner may raise
 * the price in the dashboard before this constant catches up. Refusing to
 * deliver something a reader has actually paid for would be the worse bug by
 * far, so a surprise here is a log line, not a rejection.
 */
export function amountLooksRight(
  amountTotalCents: number | null | undefined,
): boolean {
  if (typeof amountTotalCents !== "number") return false;
  const { netCents } = breakdown();
  return amountTotalCents === PRICE_CENTS || amountTotalCents === netCents;
}

/**
 * The split of a payment that has actually happened, from Stripe's own figures.
 *
 * ⚠️ Prefer this to `breakdown()` for anything describing a REAL payment (the
 * receipt, above all). `breakdown` computes what we advertise; this reports what
 * was charged, and the two legitimately differ: with Stripe Tax on, a buyer
 * outside the EU pays no Dutch VAT at all. A receipt that states a tax the buyer
 * was never charged is a wrong tax document, not a cosmetic slip.
 *
 * `amountTax` absent (an older event, tax not enabled) falls back to the
 * advertised split, which is right for the Dutch buyer who is the normal case.
 */
export function splitFromStripe(
  amountTotalCents: number | undefined,
  amountTaxCents: number | undefined,
): PriceBreakdown {
  const gross = typeof amountTotalCents === "number" ? amountTotalCents : PRICE_CENTS;
  if (typeof amountTaxCents !== "number") return breakdown(gross);
  const vatCents = Math.max(0, Math.min(amountTaxCents, gross));
  const netCents = gross - vatCents;
  return { grossCents: gross, vatCents, netCents, ratePct: rateFromAmounts(netCents, vatCents) };
}

/** The effective rate two amounts imply, to the nearest whole percent. 21, not
 *  20.9: the rate is a legal fact with a round value, and the pennies of
 *  difference are rounding inside the gross. */
export function rateFromAmounts(netCents: number, vatCents: number): number {
  if (vatCents <= 0 || netCents <= 0) return 0;
  return Math.round((vatCents / netCents) * 100);
}

// ---------------------------------------------------------------------------
// Describing the tax on a receipt, without asserting something we do not know.
//
// ⚠️ WHY THIS EXISTS. Zero tax on a payment has two completely different
// meanings. For a buyer outside the EU it is correct and worth explaining. For a
// buyer INSIDE the EU it means Stripe Tax is not activated or has no
// registration, and the €7.00 still includes 21% BTW that the seller owes the
// Belastingdienst whether Stripe worked it out or not.
//
// Found on the real account: Stripe Tax was switched on in the API call but
// never activated in the dashboard, so `total_details.amount_tax` came back 0
// for everybody. A receipt that reads "BTW none (supplied outside the EU)" to a
// Dutch buyer is a wrong tax document, and it would have been sent quietly.
// ---------------------------------------------------------------------------

/** EU member states, for deciding what a zero-tax line MEANS. */
const EU = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU",
  "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
]);

export function isEuCountry(code: string | undefined | null): boolean {
  return typeof code === "string" && EU.has(code.trim().toUpperCase());
}

export type VatDescription =
  /** Tax was charged and can be stated plainly. */
  | { kind: "charged"; line: string }
  /** No EU tax, correctly, because the buyer is outside it. */
  | { kind: "outside-eu"; line: string }
  /** No tax on an EU sale. Almost certainly a misconfiguration. */
  | { kind: "missing"; line: string };

/**
 * The BTW line for a receipt, and a flag saying whether it should worry anyone.
 *
 * The "missing" wording deliberately states only what is true (nothing was
 * itemised) and does not claim a reason, because the honest reason is that
 * something is wrong at our end and the reader is not the person who can fix it.
 */
export function describeVat(
  vatCents: number,
  ratePct: number,
  country: string | undefined | null,
): VatDescription {
  if (vatCents > 0) {
    return { kind: "charged", line: `Of which BTW   ${formatEur(vatCents)} (${ratePct}%)` };
  }
  if (country && !isEuCountry(country)) {
    return { kind: "outside-eu", line: `BTW            none (supplied outside the EU)` };
  }
  return { kind: "missing", line: `BTW            not itemised` };
}
