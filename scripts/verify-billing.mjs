// Drift · Phase 32 — supporter unlock backend verification.
//
// Run:  npm run verify:billing   (loads .env via node --env-file)
//
// Proves the two things the meter's honesty rests on:
//
//   1. IT COUNTS. record_stop() adds exactly one, returns the new total, and
//      supporter_status() reports the same number plus the entitlement.
//   2. IT CANNOT BE EDITED. Both tables are readable only by their owner and
//      have NO write policy at all, so a reader holding the publishable key
//      cannot zero their counter or grant themselves the unlock. That is the
//      whole security model (see the migration header), and it is exactly the
//      kind of thing that is true until someone adds a convenient policy.
//   3. THE REFUND COOLDOWN SURVIVES A RE-PURCHASE (Phase 32B). A refund stamp
//      that the next grant wipes is a waiting period that never fires, and no
//      unit test can see it, because what does the wiping is PostgREST.
//
// It provisions its OWN throwaway user rather than reusing SUPABASE_EMAIL,
// because the interesting case is an account created after the grandfathering
// sweep: one that starts without the unlock.

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SECRET = process.env.SUPABASE_SECRET_KEY;
const PUBLISHABLE =
  process.env.SUPABASE_PUBLISH_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

let failures = 0;
const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const bad = (m) => {
  failures++;
  console.log(`  \x1b[31m✗\x1b[0m ${m}`);
};

function requireEnv() {
  const missing = [];
  if (!URL) missing.push("SUPABASE_URL");
  if (!SECRET) missing.push("SUPABASE_SECRET_KEY");
  if (!PUBLISHABLE) missing.push("SUPABASE_PUBLISH_KEY");
  if (missing.length) {
    console.error(`Missing env: ${missing.join(", ")}\nAdd them to .env`);
    process.exit(2);
  }
}

async function main() {
  requireEnv();
  console.log(`\nVerifying the supporter unlock at ${URL}\n`);

  const admin = createClient(URL, SECRET, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. The migration is applied.
  console.log("Schema:");
  for (const t of ["entitlements", "usage_daily"]) {
    const { error } = await admin.from(t).select("*").limit(1);
    if (error) {
      bad(
        `${t}: ${error.message}` +
          "\n      → paste supabase/migrations/0005_phase32_supporter.sql into Studio → SQL Editor → Run",
      );
    } else ok(`${t} exists`);
  }
  if (failures) return;

  const { count: beta } = await admin
    .from("entitlements")
    .select("*", { count: "exact", head: true })
    .eq("source", "beta");
  ok(`grandfathered accounts: ${beta ?? 0}`);

  // 2. A throwaway account, created AFTER the sweep, so it starts metered.
  console.log("\nA new (unentitled) reader:");
  const email = `verify-billing-${randomUUID().slice(0, 8)}@example.com`;
  const password = randomUUID();
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created.error) {
    bad(`create test user: ${created.error.message}`);
    return;
  }
  const uid = created.data.user.id;

  const user = createClient(URL, PUBLISHABLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const signIn = await user.auth.signInWithPassword({ email, password });
  if (signIn.error) {
    bad(`sign in: ${signIn.error.message}`);
    await admin.auth.admin.deleteUser(uid);
    return;
  }
  ok("signed in");

  try {
    // 3. It counts, one at a time.
    const first = await user.rpc("record_stop");
    const firstRow = first.data?.[0];
    if (first.error || firstRow?.stops !== 1) {
      bad(`record_stop (first): ${first.error?.message ?? JSON.stringify(first.data)}`);
    } else ok(`record_stop → ${firstRow.stops} (day ${firstRow.day}, Europe/Amsterdam)`);

    const second = await user.rpc("record_stop");
    if (second.data?.[0]?.stops !== 2) {
      bad(`record_stop (second) → ${JSON.stringify(second.data)}, expected 2`);
    } else ok("record_stop adds exactly one");

    // 4. The status call agrees, and reports no entitlement.
    const status = await user.rpc("supporter_status");
    const s = status.data?.[0];
    if (status.error || s?.stops !== 2) {
      bad(`supporter_status: ${status.error?.message ?? JSON.stringify(status.data)}`);
    } else if (s.supporter !== false) {
      bad("supporter_status says this brand-new account already holds the unlock");
    } else ok("supporter_status → 2 stops, supporter false");

    // 5. THE IMPORTANT ONE. The reader cannot rewrite any of it.
    console.log("\nWhat a reader must not be able to do:");

    const zero = await user.from("usage_daily").update({ stops: 0 }).eq("user_id", uid);
    const zeroed = (await admin.from("usage_daily").select("stops").eq("user_id", uid).limit(1))
      .data?.[0]?.stops;
    if (zeroed === 2) ok("cannot zero their own counter");
    else bad(`counter was rewritten to ${zeroed} (update error was: ${zero.error?.message ?? "none"})`);

    const grant = await user
      .from("entitlements")
      .insert({ user_id: uid, kind: "supporter", source: "purchase" });
    const granted = (await admin.from("entitlements").select("user_id").eq("user_id", uid)).data ?? [];
    if (granted.length === 0) ok("cannot grant themselves the unlock");
    else bad(`entitlement was self-inserted (insert error was: ${grant.error?.message ?? "none"})`);

    const wipe = await user.from("usage_daily").delete().eq("user_id", uid);
    const left = (await admin.from("usage_daily").select("day").eq("user_id", uid)).data ?? [];
    if (left.length === 1) ok("cannot delete their usage row to start over");
    else bad(`usage row was deleted (delete error was: ${wipe.error?.message ?? "none"})`);

    // 6. And cannot read anyone else's.
    const others = await user.from("usage_daily").select("user_id").neq("user_id", uid);
    if ((others.data ?? []).length === 0) ok("cannot read another reader's usage");
    else bad(`saw ${others.data.length} row(s) belonging to other people`);

    // 7. A granted entitlement flips the status (the webhook's job, done by hand).
    console.log("\nWith the unlock granted (as the webhook would):");
    const gr = await admin
      .from("entitlements")
      .insert({ user_id: uid, kind: "supporter", source: "manual" });
    if (gr.error) bad(`admin grant: ${gr.error.message}`);
    else {
      const after = await user.rpc("supporter_status");
      if (after.data?.[0]?.supporter === true) ok("supporter_status → supporter true");
      else bad(`supporter_status did not see the grant: ${JSON.stringify(after.data)}`);
    }

    // 8. Revoking (a refund) takes it away again.
    await admin
      .from("entitlements")
      .update({ revoked_at: new Date().toISOString() })
      .eq("user_id", uid);
    const afterRevoke = await user.rpc("supporter_status");
    if (afterRevoke.data?.[0]?.supporter === false) ok("a revoked entitlement stops counting");
    else bad(`revoke was ignored: ${JSON.stringify(afterRevoke.data)}`);
    // 9. The refund cooldown (Phase 32B).
    //
    // The rule itself is unit tested and needs no database. What can only be
    // checked HERE is the three things it rests on: that a reader can see their
    // own refund stamp (without it the buy button cannot count down), that they
    // cannot rewrite it (or the wait is one console line away from over), and
    // above all that BUYING AGAIN LATER DOES NOT WIPE IT. That last one is not
    // our code at all: it is PostgREST leaving columns absent from an upsert
    // payload alone. If that ever changed, the cooldown would keep passing every
    // unit test and quietly never fire again.
    console.log("\nThe refund cooldown:");

    const columns = await admin
      .from("entitlements")
      .select("refunded_at, refund_count")
      .eq("user_id", uid)
      .limit(1);
    if (columns.error) {
      bad(
        `refunded_at / refund_count: ${columns.error.message}` +
          "\n      → paste supabase/migrations/0006_refund_cooldown.sql into Studio → SQL Editor → Run",
      );
    } else {
      ok("entitlements carries refunded_at + refund_count");

      const session = `cs_verify_${uid.slice(0, 8)}`;
      const intent = `pi_verify_${uid.slice(0, 8)}`;

      // Make it look like a real purchase, then refund it the way both refund
      // paths do (lib/billing/server.ts → markRefunded).
      await admin
        .from("entitlements")
        .update({
          source: "purchase",
          revoked_at: null,
          refunded_at: null,
          refund_count: 0,
          stripe_session_id: session,
          stripe_payment_intent: intent,
        })
        .eq("user_id", uid);

      const refundedAt = new Date().toISOString();
      const refund = await admin
        .from("entitlements")
        .update({ revoked_at: refundedAt, refunded_at: refundedAt, refund_count: 1 })
        .eq("user_id", uid)
        .is("revoked_at", null);
      if (refund.error) bad(`recording a refund: ${refund.error.message}`);
      else ok("a refund records revoked_at + refunded_at + refund_count");

      const mine = await user
        .from("entitlements")
        .select("refunded_at, refund_count")
        .limit(1);
      if (mine.data?.[0]?.refunded_at) ok("the reader can see their own refund stamp");
      else bad(`the reader cannot read refunded_at: ${mine.error?.message ?? "no row"}`);

      const tamper = await user
        .from("entitlements")
        .update({ refunded_at: null, refund_count: 0 })
        .eq("user_id", uid);
      const afterTamper = (
        await admin.from("entitlements").select("refunded_at").eq("user_id", uid).limit(1)
      ).data?.[0]?.refunded_at;
      if (afterTamper) ok("cannot clear their own cooldown");
      else bad(`refunded_at was wiped by the reader (error was: ${tamper.error?.message ?? "none"})`);

      // THE LOAD-BEARING ONE. Exactly the payload the webhook's grant sends,
      // refund columns deliberately absent. `revoked_at` must clear (or nobody
      // could ever buy again) and `refunded_at` must survive (or the cooldown
      // is over the moment somebody pays past it).
      const regrant = await admin.from("entitlements").upsert(
        {
          user_id: uid,
          kind: "supporter",
          source: "purchase",
          granted_at: new Date().toISOString(),
          revoked_at: null,
          stripe_customer_id: null,
          stripe_session_id: `${session}_2`,
          stripe_payment_intent: `${intent}_2`,
        },
        { onConflict: "user_id" },
      );
      if (regrant.error) bad(`re-granting: ${regrant.error.message}`);
      else {
        const after = (
          await admin
            .from("entitlements")
            .select("revoked_at, refunded_at, refund_count")
            .eq("user_id", uid)
            .limit(1)
        ).data?.[0];
        if (after?.revoked_at) bad("buying again did not clear revoked_at");
        else ok("buying again clears revoked_at");
        // ⚠️ Compared as INSTANTS, not as strings. Postgres hands the timestamp
        // back as `…699+00:00` where JavaScript wrote `…699Z`: the same moment
        // spelled two ways, and comparing the text fails on every run while the
        // data is perfectly correct. (It did, once. This is the fix.)
        const kept = after?.refunded_at
          ? new Date(after.refunded_at).getTime() === new Date(refundedAt).getTime()
          : false;
        if (kept && after?.refund_count === 1) {
          ok("buying again does NOT wipe the refund history");
        } else {
          bad(
            `the refund history did not survive a re-purchase: refunded_at=${after?.refunded_at} ` +
              `(expected the instant ${refundedAt}), refund_count=${after?.refund_count} ` +
              `(expected 1). The cooldown is not enforceable like this.`,
          );
        }
      }
    }
  } finally {
    // Deleting the auth user cascades both new tables away with it.
    await admin.auth.admin.deleteUser(uid);
    const leftovers = (await admin.from("entitlements").select("user_id").eq("user_id", uid)).data ?? [];
    if (leftovers.length === 0) ok("deleting the account removed the entitlement (cascade)");
    else bad("an entitlement outlived the account it belonged to");
  }

  console.log(
    failures
      ? `\n\x1b[31m${failures} check(s) failed.\x1b[0m\n`
      : "\n\x1b[32mAll checks passed — the meter counts, it cannot be edited, and a refund sticks.\x1b[0m\n",
  );
}

main()
  .then(() => process.exit(failures ? 1 : 0))
  .catch((e) => {
    console.error("\nUnexpected error:", e);
    process.exit(1);
  });
