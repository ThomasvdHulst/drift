import { NextResponse } from "next/server";
import { NO_STORE } from "@/lib/cache-headers";
import {
  adminClient,
  bearerToken,
  callerFromToken,
  holdsUnlock,
  readEntitlement,
  returnOrigin,
  stripeClient,
} from "@/lib/billing/server";
import { CURRENCY } from "@/lib/billing/price";
import { assessCooldown, formatRemaining } from "@/lib/billing/cooldown";

export const dynamic = "force-dynamic";

/**
 * How long a started checkout stays payable, in minutes (Phase 32B).
 *
 * Stripe's own default is 24 hours, and that default is what makes the cooldown
 * above leaky: a session created BEFORE a refund is still payable for a day
 * AFTER it, so somebody could open checkout in several tabs, buy, refund, and
 * pay the next stale tab without ever coming back through this route. Two hours
 * closes almost all of that window at no cost to a real buyer, who decides about
 * €7 in a minute or two. Stripe's own floor is 30 minutes if it ever needs to be
 * tighter. An expired session is not a lost sale: the page says so and the buy
 * button starts a fresh one.
 */
const SESSION_LIFETIME_MINUTES = 120;

// POST /api/billing/checkout — start a Stripe Checkout session for the supporter
// unlock (Phase 32). Returns { url } for the browser to follow.
//
// Four things this route is careful about:
//
//   1. IT DOES NOT TRUST THE BODY. The user id is taken from the caller's own
//      verified JWT, never from what was posted, so nobody can buy an unlock
//      into somebody else's account (or, more likely, into a typo).
//   2. IT REFUSES A SECOND PURCHASE. Someone who already holds the unlock is
//      turned away here rather than charged and refunded later. The webhook is
//      idempotent as well, but the kind thing is to not take the money.
//   3. IT REFUSES A PURCHASE INSIDE THE REFUND COOLDOWN (Phase 32B). This is
//      THE gate: it is the only place a purchase can begin, so a refund that
//      started a waiting period stops the next one here, before any money moves.
//      The buy button hides itself with the same rule, but that is a courtesy;
//      this is the check that counts, because a browser can be told anything.
//   4. IT NEVER LEAKS A KEY. Everything Stripe happens server-side; the browser
//      only ever receives a redirect URL that Stripe itself issued.
//
// Graceful (CLAUDE.md §4): with Stripe or Supabase unconfigured it answers
// { ok: false, unconfigured: true } with HTTP 200, so a clone without a payment
// account renders the page and simply cannot buy, rather than erroring.
export async function POST(request: Request) {
  const stripe = stripeClient();
  const admin = adminClient();
  const priceId = process.env.STRIPE_PRICE_ID;

  if (!stripe || !admin || !priceId) {
    return NextResponse.json(
      { ok: false, unconfigured: true },
      { status: 200, headers: NO_STORE },
    );
  }

  const caller = await callerFromToken(admin, bearerToken(request));
  if (!caller) {
    return NextResponse.json(
      { ok: false, error: "not signed in" },
      { status: 401, headers: NO_STORE },
    );
  }

  // One read, two questions ("do they hold it?" and "did they just refund?"),
  // so the two answers cannot come from different moments. A read that FAILED
  // arrives here as no row and lets the sale through, which is the right
  // direction: refusing somebody's money because the database had a bad second
  // is worse than one purchase that should have waited.
  const { row: held } = await readEntitlement(admin, caller.id);

  if (holdsUnlock(held)) {
    return NextResponse.json(
      { ok: false, error: "already a supporter", already: true },
      { status: 409, headers: NO_STORE },
    );
  }

  // The refund cooldown. Refused with the SAME 409 shape as "already a
  // supporter", plus the moment it lifts, so the page can count down to it
  // rather than showing a dead end. The reason is stated plainly and the
  // withdrawal right is untouched: this delays buying again, never a refund.
  const cooldown = assessCooldown(held);
  if (cooldown.kind === "blocked") {
    console.info(
      `[api/billing/checkout] ${caller.id} is inside the refund cooldown ` +
        `(${cooldown.refunds} refund(s), ${formatRemaining(cooldown.msLeft)} left)`,
    );
    return NextResponse.json(
      {
        ok: false,
        cooldown: true,
        until: cooldown.until.toISOString(),
        error: `A refunded purchase cannot be bought again straight away. This account can buy the unlock again in ${formatRemaining(cooldown.msLeft)}.`,
      },
      { status: 409, headers: NO_STORE },
    );
  }

  const origin = returnOrigin(request);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      currency: CURRENCY,
      // Both carry the same value. `metadata` is what the webhook reads;
      // `client_reference_id` is the one that shows in the Stripe dashboard's
      // own UI, which is where the owner will look when something is odd.
      metadata: { user_id: caller.id },
      client_reference_id: caller.id,
      ...(caller.email ? { customer_email: caller.email } : {}),
      // Stripe Tax works out the right VAT for the buyer's country, which is
      // what keeps a non-EU buyer from being charged Dutch VAT they do not owe.
      // It needs an address to do that, hence the collection below.
      automatic_tax: { enabled: true },
      billing_address_collection: "required",
      // ⚠️ MANAGED PAYMENTS OFF, AND THIS IS THE LINE THAT PUTS iDEAL BACK.
      //
      // Stripe enables "Managed Payments" by default on new accounts and lets it
      // choose the payment methods. On this account it chose `card` + `bancontact`
      // and silently dropped **iDEAL**, which is over half of all Dutch online
      // payments and the main reason this integration exists. Measured on the
      // real account: a session created any other way (with an NL customer, a BE
      // customer, no customer, with and without automatic tax) came back
      // `["card","bancontact"]` every time, while the account's own capabilities
      // and its default payment method configuration both had iDEAL on. It was
      // not a setting anyone had got wrong.
      //
      // Turning it off here falls back to the dashboard's payment method
      // configuration, which is the behaviour the rest of this route assumes:
      // the list stays DYNAMIC and driven by the dashboard (currently card,
      // iDEAL, Bancontact, EPS, Link, Amazon Pay, and the wallets), so enabling
      // one later is still a settings change rather than a deploy. Nothing is
      // pinned here on purpose; pinning would freeze the list into this file.
      //
      // It is set per request rather than left to the account-wide toggle so it
      // cannot be undone by a dashboard click, or by Stripe changing a default.
      managed_payments: { enabled: false },
      locale: "auto",
      expires_at:
        Math.floor(Date.now() / 1000) + SESSION_LIFETIME_MINUTES * 60,
      success_url: `${origin}/account?supported=1`,
      cancel_url: `${origin}/supporter?cancelled=1`,
    });

    if (!session.url) {
      return NextResponse.json(
        { ok: false, error: "Stripe returned no checkout URL" },
        { status: 502, headers: NO_STORE },
      );
    }
    return NextResponse.json(
      { ok: true, url: session.url },
      { status: 200, headers: NO_STORE },
    );
  } catch (err) {
    // The message is Stripe's and can name a misconfigured price or a disabled
    // account, which is exactly what the owner needs in the server log. The
    // reader gets a plain sentence.
    console.error("[api/billing/checkout]", err);
    return NextResponse.json(
      { ok: false, error: "Could not start checkout. Please try again." },
      { status: 502, headers: NO_STORE },
    );
  }
}
