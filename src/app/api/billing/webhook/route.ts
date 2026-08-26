import { NextResponse } from "next/server";
import { NO_STORE } from "@/lib/cache-headers";
import {
  adminClient,
  markRefunded,
  readEntitlement,
  stripeClient,
} from "@/lib/billing/server";
import { assessCooldown, formatRemaining } from "@/lib/billing/cooldown";
import { decide } from "@/lib/billing/events";
import { amountLooksRight, describeVat, splitFromStripe } from "@/lib/billing/price";
import { supporterReceiptEmail } from "@/lib/email/messages";
import { sendViaResend } from "@/lib/email/send";

export const dynamic = "force-dynamic";

// POST /api/billing/webhook — Stripe tells us a payment happened, or a refund.
//
// THIS ROUTE IS THE ONLY THING THAT GRANTS THE UNLOCK, and it is reachable by
// anyone on the internet, so the signature check is the whole security boundary.
// Two rules follow from that and neither is negotiable:
//
//   1. THE RAW BODY, NOT THE PARSED ONE. The signature is computed over the
//      exact bytes Stripe sent. `await request.text()` before anything touches
//      it; a `request.json()` anywhere above would re-serialise the payload and
//      every legitimate event would start failing verification.
//   2. NO SECRET, NO PROCESSING. If STRIPE_WEBHOOK_SECRET is missing we refuse
//      rather than trusting the body, because an unverified webhook is simply a
//      stranger telling us who has paid.
//
// What it does NOT do is decide anything itself: `lib/billing/events.ts` holds
// the rules (which is where they can be tested against the shapes that never
// occur in a happy-path manual test), and this route verifies, applies, replies.
//
// REPLYING 200 MATTERS. Stripe retries anything else for days. A 200 means
// "received and understood", including for events we deliberately ignore. It is
// reserved for a genuine server-side failure that a retry could fix.
export async function POST(request: Request) {
  const stripe = stripeClient();
  const admin = adminClient();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  // Read the body first and unconditionally: it can only be consumed once.
  const raw = await request.text();
  const signature = request.headers.get("stripe-signature") ?? "";

  if (!stripe || !admin || !secret) {
    console.warn("[billing/webhook] not configured; ignoring event");
    return NextResponse.json(
      { ok: false, unconfigured: true },
      { status: 200, headers: NO_STORE },
    );
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, signature, secret);
  } catch (err) {
    // Bad or missing signature. 400 so Stripe stops retrying, and so a probe
    // gets nothing useful back.
    console.error("[billing/webhook] signature verification failed", err);
    return NextResponse.json(
      { ok: false, error: "bad signature" },
      { status: 400, headers: NO_STORE },
    );
  }

  const decision = decide(event as { type?: unknown; data?: { object?: unknown } });

  if (decision.kind === "ignore") {
    console.info(`[billing/webhook] ${event.type}: ${decision.why}`);
    return NextResponse.json({ ok: true, ignored: true }, { headers: NO_STORE });
  }

  try {
    if (decision.kind === "revoke") {
      // The refund path, which is how the 14 day withdrawal is honoured: the
      // owner refunds in the Stripe dashboard and this undoes the grant.
      //
      // `markRefunded` does the revoke AND starts the waiting period before this
      // account can buy again (Phase 32B). It is shared with the withdraw route
      // so the cooldown does not depend on which of the two ways the refund
      // happened to arrive, and it no-ops when the other one got here first,
      // which is also what makes a redelivered event harmless.
      const { applied, refunds } = await markRefunded(admin, {
        paymentIntent: decision.paymentIntent,
      });
      console.info(
        applied
          ? `[billing/webhook] revoked for ${decision.paymentIntent} (refund #${refunds})`
          : `[billing/webhook] ${decision.paymentIntent} was already revoked; nothing to do`,
      );
      return NextResponse.json({ ok: true, revoked: true }, { headers: NO_STORE });
    }

    // A grant. Worth logging when the money is not what we advertise, but never
    // worth refusing over: see `amountLooksRight`. Somebody has paid.
    if (!amountLooksRight(decision.amountTotal)) {
      console.warn(
        `[billing/webhook] unexpected amount ${decision.amountTotal} ${decision.currency} ` +
          `for session ${decision.sessionId} — granted anyway, check the price in Stripe`,
      );
    }

    // A paid session from an account that is inside the refund cooldown.
    //
    // It grants ANYWAY, and the reasoning matters. The gate is the checkout
    // route, which is the only place a purchase can begin; a payment reaching
    // here despite it came from a Checkout Session created before the refund and
    // paid after it (which is why sessions now expire in two hours). By the time
    // we know, the money has already been taken, and the two alternatives are
    // both worse than granting: refusing would leave somebody having paid for
    // nothing, and auto-refunding would spend a SECOND fee to reach the same
    // place a refund already reached. So it is granted and shouted about, and
    // `refund_count` on the row is what tells the owner whether it is a stale
    // tab or a pattern worth acting on by hand.
    const { row: existing } = await readEntitlement(admin, decision.userId);
    const cooldown = assessCooldown(existing);
    if (cooldown.kind === "blocked") {
      console.warn(
        `[billing/webhook] COOLDOWN BYPASSED: ${decision.userId} paid session ` +
          `${decision.sessionId} with ${formatRemaining(cooldown.msLeft)} of the ` +
          `refund cooldown left (${cooldown.refunds} refund(s) on record). Granted ` +
          `anyway, because the money is already taken. See docs/supporter.md §7.`,
      );
    }

    // Idempotent by construction: user_id is the primary key, so a webhook
    // delivered twice (Stripe is at-least-once) lands on the same row. The
    // update also clears `revoked_at`, which is what makes buying again after a
    // refund work without any special case.
    //
    // ⚠️ `refunded_at` and `refund_count` are ABSENT from this object on purpose.
    // PostgREST builds its ON CONFLICT DO UPDATE from the keys it is given, so a
    // column that is not here keeps its value. Adding them (even as null, even
    // "for completeness") would wipe the refund history on the next purchase and
    // silently turn the cooldown off.
    const { error } = await admin.from("entitlements").upsert(
      {
        user_id: decision.userId,
        kind: "supporter",
        source: "purchase",
        granted_at: new Date().toISOString(),
        revoked_at: null,
        stripe_customer_id: decision.customerId ?? null,
        stripe_session_id: decision.sessionId,
        stripe_payment_intent: decision.paymentIntent ?? null,
      },
      { onConflict: "user_id" },
    );
    if (error) throw error;
    console.info(`[billing/webhook] granted to ${decision.userId}`);

    // The receipt: legally the confirmation on a durable medium, so it is sent
    // AFTER the grant has actually landed. Best effort, like every other send in
    // the app — a mail provider having a bad afternoon must not turn into Stripe
    // retrying a grant that already succeeded.
    // ⚠️ An EU sale that carried no tax is a MISCONFIGURATION, not a fact about
    // the buyer: Stripe Tax is not activated or has no registration, and the
    // seller still owes the BTW inside that €7. It cannot be fixed from here and
    // it must not be guessed at on the receipt, so it is shouted into the log.
    const split = splitFromStripe(decision.amountTotal, decision.amountTax);
    const vat = describeVat(split.vatCents, split.ratePct, decision.country);
    if (vat.kind === "missing") {
      console.warn(
        `[billing/webhook] NO TAX on session ${decision.sessionId} for country ` +
          `${decision.country ?? "unknown"}. If that is an EU buyer, Stripe Tax is not ` +
          `set up (dashboard → Tax → activate + add the NL registration) and the BTW ` +
          `inside this payment is still owed. See docs/supporter.md §3.3.`,
      );
    }

    if (decision.email) {
      // From Stripe's OWN figures, never re-derived: a buyer outside the EU
      // pays no Dutch VAT, and a receipt stating a tax they were not charged is
      // a wrong tax document rather than a cosmetic slip.
      const receipt = supporterReceiptEmail({
        grossCents: split.grossCents,
        vatCents: split.vatCents,
        netCents: split.netCents,
        ratePct: split.ratePct,
        paidAt: new Date(),
        reference: decision.sessionId,
        ...(decision.country ? { country: decision.country } : {}),
      });
      await sendViaResend({
        to: decision.email,
        subject: receipt.subject,
        html: receipt.html,
        ...(receipt.text ? { text: receipt.text } : {}),
      });
    }

    return NextResponse.json({ ok: true, granted: true }, { headers: NO_STORE });
  } catch (err) {
    // A real failure to write. 500 so Stripe retries, because the alternative is
    // a reader who paid and never received anything.
    console.error("[billing/webhook] could not apply", err);
    return NextResponse.json(
      { ok: false, error: "could not apply" },
      { status: 500, headers: NO_STORE },
    );
  }
}
