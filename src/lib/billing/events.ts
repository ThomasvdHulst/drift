// ---------------------------------------------------------------------------
// Stripe event → what should happen to an entitlement (Phase 32).
//
// WHY THIS IS A SEPARATE, PURE FILE. The webhook route does three things:
// verify a signature, decide, and write. The first is Stripe's library and the
// third is one database call; the DECIDING is the part with the rules in it, so
// it lives here where it can be tested against every shape a real webhook can
// arrive in — including the ones that are easy to get wrong and impossible to
// reproduce by hand (an unpaid session, a duplicate delivery, a partial refund).
//
// The guiding rule, when a case is ambiguous: NEVER take away access somebody
// paid for on a guess, and never grant on a payment that has not actually
// happened. Everything else is `ignore`, which is always safe — Stripe retries,
// and an event we did nothing with is an event we can look at later.
// ---------------------------------------------------------------------------

/** Minimal shapes: only the fields decided on, so a test can build one by hand. */
interface CheckoutSessionLike {
  id?: unknown;
  payment_status?: unknown;
  client_reference_id?: unknown;
  metadata?: { user_id?: unknown } | null;
  customer?: unknown;
  customer_details?: { email?: unknown } | null;
  customer_email?: unknown;
  payment_intent?: unknown;
  amount_total?: unknown;
  total_details?: { amount_tax?: unknown } | null;
  currency?: unknown;
}

interface ChargeLike {
  payment_intent?: unknown;
  refunded?: unknown;
  amount?: unknown;
  amount_refunded?: unknown;
}

export interface StripeEventLike {
  type?: unknown;
  data?: { object?: unknown } | null;
}

export type BillingDecision =
  | {
      kind: "grant";
      userId: string;
      sessionId: string;
      customerId?: string;
      paymentIntent?: string;
      amountTotal?: number;
      /** Stripe Tax's own figure. Authoritative: never re-derive the VAT. */
      amountTax?: number;
      currency?: string;
      email?: string;
    }
  | { kind: "revoke"; paymentIntent: string }
  | { kind: "ignore"; why: string };

const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() ? v : undefined;

/** Stripe returns either an id or an expanded object for a reference. */
const refId = (v: unknown): string | undefined =>
  str(v) ??
  (typeof v === "object" && v !== null
    ? str((v as { id?: unknown }).id)
    : undefined);

export function decide(event: StripeEventLike): BillingDecision {
  const type = str(event?.type);
  if (!type) return { kind: "ignore", why: "no event type" };
  const object = event?.data?.object;

  // The two events that mean "this reader has paid".
  //
  // `completed` covers a card, which settles immediately.
  // `async_payment_succeeded` covers a method that confirms later. iDEAL is
  // normally immediate, but Stripe explicitly documents that it can arrive this
  // way, and a supporter whose payment landed on the slow path must not be left
  // holding nothing. Both funnel into the same grant, and the unique session id
  // in the database makes handling both harmless if both ever fire.
  if (
    type === "checkout.session.completed" ||
    type === "checkout.session.async_payment_succeeded"
  ) {
    const s = (object ?? {}) as CheckoutSessionLike;

    // `paid` is the only status that means money moved. `unpaid` on a
    // `completed` event is the delayed-notification case: do nothing and wait
    // for the async event, rather than handing out the unlock hopefully.
    if (str(s.payment_status) !== "paid") {
      return {
        kind: "ignore",
        why: `payment_status=${String(s.payment_status)} — not paid (yet)`,
      };
    }

    const sessionId = str(s.id);
    if (!sessionId) return { kind: "ignore", why: "session has no id" };

    // Whose is it? `metadata.user_id` is what the checkout route sets;
    // `client_reference_id` carries the same value and is the fallback if a
    // session was ever created another way (the dashboard, a payment link).
    const userId = str(s.metadata?.user_id) ?? str(s.client_reference_id);
    if (!userId) {
      // Deliberately not an error the webhook retries: without a user there is
      // nothing to grant, and Stripe would redeliver forever. It is logged and
      // handed to the owner instead (docs/supporter.md §4b grants by hand).
      return { kind: "ignore", why: "paid session with no user id attached" };
    }

    return {
      kind: "grant",
      userId,
      sessionId,
      customerId: refId(s.customer),
      paymentIntent: refId(s.payment_intent),
      amountTotal:
        typeof s.amount_total === "number" ? s.amount_total : undefined,
      amountTax:
        typeof s.total_details?.amount_tax === "number"
          ? s.total_details.amount_tax
          : undefined,
      currency: str(s.currency),
      email: str(s.customer_details?.email) ?? str(s.customer_email),
    };
  }

  // A refund gives the money back, so it takes the unlock back with it. This is
  // how the 14-day withdrawal is honoured: the owner refunds in the Stripe
  // dashboard and this undoes the grant, with no separate admin screen to build.
  if (type === "charge.refunded") {
    const c = (object ?? {}) as ChargeLike;
    const paymentIntent = refId(c.payment_intent);
    if (!paymentIntent) {
      return { kind: "ignore", why: "refund with no payment_intent" };
    }
    // A PARTIAL refund is not a withdrawal. At €7 it would most likely be a
    // fat-fingered amount in the dashboard, and reading it as "take the unlock
    // away" would punish a reader for the owner's typo. Only a full refund,
    // which is what the withdrawal flow actually does, revokes.
    const amount = typeof c.amount === "number" ? c.amount : undefined;
    const refunded =
      typeof c.amount_refunded === "number" ? c.amount_refunded : undefined;
    if (amount !== undefined && refunded !== undefined && refunded < amount) {
      return {
        kind: "ignore",
        why: `partial refund (${refunded} of ${amount}) — access kept`,
      };
    }
    return { kind: "revoke", paymentIntent };
  }

  return { kind: "ignore", why: `unhandled event type ${type}` };
}
