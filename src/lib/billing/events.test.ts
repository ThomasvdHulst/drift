import { describe, it, expect } from "vitest";
import { decide } from "./events";

const session = (over: Record<string, unknown> = {}) => ({
  type: "checkout.session.completed",
  data: {
    object: {
      id: "cs_test_123",
      payment_status: "paid",
      metadata: { user_id: "user-1" },
      customer: "cus_1",
      payment_intent: "pi_1",
      amount_total: 700,
      currency: "eur",
      customer_details: { email: "reader@example.com" },
      ...over,
    },
  },
});

const charge = (over: Record<string, unknown> = {}) => ({
  type: "charge.refunded",
  data: {
    object: { payment_intent: "pi_1", amount: 700, amount_refunded: 700, ...over },
  },
});

describe("granting", () => {
  it("grants on a paid checkout session", () => {
    expect(decide(session())).toEqual({
      kind: "grant",
      userId: "user-1",
      sessionId: "cs_test_123",
      customerId: "cus_1",
      paymentIntent: "pi_1",
      amountTotal: 700,
      currency: "eur",
      email: "reader@example.com",
    });
  });

  it("grants on the async event too, so a slow iDEAL payment is not lost", () => {
    const e = { ...session(), type: "checkout.session.async_payment_succeeded" };
    expect(decide(e)).toMatchObject({ kind: "grant", userId: "user-1" });
  });

  it("does NOT grant on a completed-but-unpaid session", () => {
    // The delayed-notification case. Handing out the unlock here would give it
    // away to anyone who starts a checkout and never pays.
    expect(decide(session({ payment_status: "unpaid" }))).toMatchObject({
      kind: "ignore",
    });
    expect(decide(session({ payment_status: "no_payment_required" }))).toMatchObject({
      kind: "ignore",
    });
  });

  it("falls back to client_reference_id when metadata is missing", () => {
    const e = session({ metadata: null, client_reference_id: "user-9" });
    expect(decide(e)).toMatchObject({ kind: "grant", userId: "user-9" });
  });

  it("ignores a paid session with nobody attached, rather than guessing", () => {
    const e = session({ metadata: null, client_reference_id: null });
    expect(decide(e)).toEqual({
      kind: "ignore",
      why: "paid session with no user id attached",
    });
  });

  it("reads a reference that arrived expanded rather than as an id", () => {
    const e = session({ customer: { id: "cus_exp" }, payment_intent: { id: "pi_exp" } });
    expect(decide(e)).toMatchObject({ customerId: "cus_exp", paymentIntent: "pi_exp" });
  });

  it("survives a session with almost nothing on it", () => {
    expect(decide({ type: "checkout.session.completed", data: { object: {} } })).toMatchObject({
      kind: "ignore",
    });
  });
});

describe("revoking", () => {
  it("revokes on a full refund", () => {
    expect(decide(charge())).toEqual({ kind: "revoke", paymentIntent: "pi_1" });
  });

  it("revokes when the amounts are absent but `refunded` is the whole charge", () => {
    expect(decide(charge({ amount: undefined, amount_refunded: undefined }))).toEqual({
      kind: "revoke",
      paymentIntent: "pi_1",
    });
  });

  it("KEEPS access on a partial refund", () => {
    // At €7 a partial refund is far more likely to be a typo in the dashboard
    // than a withdrawal, and a reader should not lose what they paid for
    // because of the seller's slip.
    expect(decide(charge({ amount_refunded: 300 }))).toMatchObject({ kind: "ignore" });
  });

  it("ignores a refund it cannot attribute", () => {
    expect(decide(charge({ payment_intent: null }))).toMatchObject({ kind: "ignore" });
  });
});

describe("everything else", () => {
  it("ignores unrelated events without throwing", () => {
    expect(decide({ type: "invoice.paid", data: { object: {} } })).toMatchObject({
      kind: "ignore",
    });
    expect(decide({})).toMatchObject({ kind: "ignore" });
    expect(decide({ type: "charge.refunded", data: null })).toMatchObject({
      kind: "ignore",
    });
  });
});
