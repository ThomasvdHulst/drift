import { NextResponse } from "next/server";
import { NO_STORE } from "@/lib/cache-headers";
import {
  adminClient,
  bearerToken,
  callerFromToken,
  stripeClient,
} from "@/lib/billing/server";
import { assessWithdrawal, type EntitlementRow } from "@/lib/billing/withdrawal";
import { withdrawalConfirmedEmail } from "@/lib/email/messages";
import { sendViaResend } from "@/lib/email/send";
import { PRICE_CENTS } from "@/lib/billing/price";

export const dynamic = "force-dynamic";

// POST /api/billing/withdraw — the reader changes their mind, and gets their
// money back immediately (Phase 32).
//
// WHY THIS IS NOT A CONTACT FORM. The obligation since 19 June 2026 is a
// withdrawal FUNCTION, continuously available. A form that emails the owner to
// go and press Refund in a dashboard technically satisfies that and practically
// does not: the reader's money then waits on somebody reading their inbox. This
// route issues the refund through Stripe on the spot. Nobody is in the loop.
//
// It is safe to automate precisely because it is so narrow. It can only ever
// refund the caller's OWN purchase, in full, once, inside the statutory 14 days,
// and only when the entitlement carries a Stripe payment to refund against.
// Every one of those conditions is decided in `lib/billing/withdrawal.ts`, where
// it is unit tested, rather than here.
//
// The reply always names WHICH case applies, because "no" for four different
// reasons needs four different sentences: a grandfathered unlock cost nothing, a
// refund already happened, the window has closed, or we cannot find the payment.
// Only the last two send anyone to a human.
export async function POST(request: Request) {
  const stripe = stripeClient();
  const admin = adminClient();

  if (!stripe || !admin) {
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

  const { data, error } = await admin
    .from("entitlements")
    .select("source, granted_at, revoked_at, stripe_payment_intent")
    .eq("user_id", caller.id)
    .limit(1);
  if (error) {
    console.error("[api/billing/withdraw] could not read entitlement", error);
    return NextResponse.json(
      { ok: false, error: "Could not check your purchase. Please try again." },
      { status: 500, headers: NO_STORE },
    );
  }

  const verdict = assessWithdrawal((data?.[0] as EntitlementRow) ?? null);
  if (verdict.kind !== "eligible") {
    return NextResponse.json(
      { ok: false, reason: verdict.kind },
      { status: 200, headers: NO_STORE },
    );
  }

  let refundedCents = PRICE_CENTS;
  try {
    const refund = await stripe.refunds.create({
      payment_intent: verdict.paymentIntent,
      reason: "requested_by_customer",
    });
    if (typeof refund.amount === "number") refundedCents = refund.amount;
  } catch (err) {
    // Already refunded upstream (the owner got there first in the dashboard) is
    // not a failure from the reader's point of view: the outcome they asked for
    // is the outcome they have. Fall through to revoking and confirming.
    const code = (err as { code?: string })?.code;
    if (code !== "charge_already_refunded") {
      console.error("[api/billing/withdraw] refund failed", err);
      return NextResponse.json(
        {
          ok: false,
          reason: "stripe-error",
          error:
            "Something went wrong issuing the refund. Please write to us and it will be sorted out by hand.",
        },
        { status: 502, headers: NO_STORE },
      );
    }
  }

  // Revoke HERE rather than waiting for the `charge.refunded` webhook, so the
  // account page is already right when the reader looks at it. The webhook still
  // fires and still runs, and finds nothing to do: its update filters on
  // `revoked_at is null`. Two paths, one outcome, in either order.
  const { error: revokeErr } = await admin
    .from("entitlements")
    .update({ revoked_at: new Date().toISOString() })
    .eq("user_id", caller.id)
    .is("revoked_at", null);
  if (revokeErr) {
    // The money is already going back, so this is not a failure to report as
    // one. It is loud in the log because the webhook is now the only thing that
    // will fix it, and if that has not been set up it will not.
    console.error("[api/billing/withdraw] refunded but could not revoke", revokeErr);
  }

  // The acknowledgement art. 6:230s(1) BW asks for, on a durable medium. Best
  // effort, like every other send: a mail provider having a bad afternoon must
  // not turn into a refund that appears to have failed.
  if (caller.email) {
    const msg = withdrawalConfirmedEmail({
      amountCents: refundedCents,
      reference: verdict.paymentIntent,
    });
    await sendViaResend({
      to: caller.email,
      subject: msg.subject,
      html: msg.html,
      ...(msg.text ? { text: msg.text } : {}),
    });
  }

  console.info(`[api/billing/withdraw] refunded ${caller.id}`);
  return NextResponse.json(
    { ok: true, refunded: true, amountCents: refundedCents },
    { status: 200, headers: NO_STORE },
  );
}
