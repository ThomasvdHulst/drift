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
      : "\n\x1b[32mAll checks passed — the meter counts and cannot be edited.\x1b[0m\n",
  );
}

main()
  .then(() => process.exit(failures ? 1 : 0))
  .catch((e) => {
    console.error("\nUnexpected error:", e);
    process.exit(1);
  });
