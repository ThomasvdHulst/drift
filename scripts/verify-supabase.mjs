// Drift · Phase 9 — Supabase backend verification.
//
// Run:  npm run verify:supabase   (loads .env via node --env-file)
//
// Proves the schema exists and Row-Level Security actually isolates users:
//   1. all three tables exist and are reachable
//   2. a signed-in user can write + read back its own row (RLS "using"/"check")
//   3. the server trigger stamps updated_at
//   4. a logged-out (anon) client CANNOT read that row (RLS truly blocks others)
//   5. upsert works on the composite-key tables (reactions, user_kv)
//   6. the write limits from 0007 hold (per-row size, per-user row count)
//
// Uses the SERVER-ONLY secret key (service role, bypasses RLS) to provision a
// confirmed test user, and the publishable key as a real end-user would.
//
// ⚠️ THE TEST USER IS PROVISIONED AND DELETED HERE, and it is deliberately NOT
// the owner's own account. It used to sign in as SUPABASE_EMAIL /
// SUPABASE_PASSWORD, and that password went stale: this script and verify:social
// both died at `sign in: Invalid login credentials` and had been dead long
// enough that nobody noticed the gates were not running. A verifier whose
// liveness depends on a hand-maintained password is a verifier that eventually
// stops verifying. This one creates what it needs and removes it, the same way
// verify:share and verify:billing already do, so it cannot rot again — and it
// writes and deletes rows, which is not something to point at a real account.

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SECRET = process.env.SUPABASE_SECRET_KEY;
const PUBLISHABLE =
  process.env.SUPABASE_PUBLISH_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
// Self-provisioned, never the owner's. See the note at the top of the file.
const EMAIL = "drift.verify.supabase@example.com";
const PASSWORD = "drift-verify-pw-123!";

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
  console.log(`\nVerifying Supabase backend at ${URL}\n`);

  const admin = createClient(URL, SECRET, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. Tables exist / reachable (service role bypasses RLS).
  console.log("Tables:");
  for (const t of ["trails", "reactions", "user_kv"]) {
    const { error } = await admin.from(t).select("*").limit(1);
    if (error) {
      const missing =
        error.code === "42P01" ||
        /does not exist|could not find the table|schema cache/i.test(
          error.message,
        );
      bad(
        `${t}: ${error.message}` +
          (missing
            ? "\n      → paste supabase/migrations/0001_phase9_schema.sql into Studio → SQL Editor → Run"
            : ""),
      );
    } else {
      ok(`${t} exists`);
    }
  }
  if (failures) return;

  // 2. Ensure a confirmed test user exists (works even if "Confirm email" is on).
  console.log("\nAuth:");
  // Remove a leftover from an interrupted run before creating, so the password
  // is always the one this file just set. `createUser` on an existing address
  // succeeds without changing the password, which is exactly how this rotted.
  const { data: existing } = await admin.auth.admin.listUsers({ perPage: 1000 });
  for (const u of existing?.users ?? []) {
    if (u.email === EMAIL) await admin.auth.admin.deleteUser(u.id);
  }
  const created = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    // Never let a verification run generate a real welcome email (see
    // scripts/bots/seed-accounts.mjs for the same stamp and the same reason).
    app_metadata: { welcomed: true, verify_script: true },
  });
  if (created.error) {
    bad(`create test user: ${created.error.message}`);
    return;
  }
  ok(`test user provisioned (${EMAIL})`);

  // Sign in as that user through the publishable key, like the app does.
  const user = createClient(URL, PUBLISHABLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const signIn = await user.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  });
  if (signIn.error) {
    bad(`sign in: ${signIn.error.message}`);
    return;
  }
  const uid = signIn.data.user.id;
  ok(`signed in (uid ${uid.slice(0, 8)}…)`);

  // 3. RLS write + read-back + trigger, on trails.
  console.log("\nRLS round-trip (trails):");
  const trailId = randomUUID();
  const ins = await user
    .from("trails")
    .insert({ id: trailId, name: "__verify__", steps: [], created_at_ms: 1 })
    .select()
    .single();
  if (ins.error) {
    bad(`owner insert: ${ins.error.message}`);
  } else {
    ok("owner can insert its own row");
    if (ins.data.updated_at) ok("server stamped updated_at");
    else bad("updated_at not set by trigger");
    if (ins.data.user_id === uid) ok("user_id defaulted to auth.uid()");
    else bad(`user_id mismatch (${ins.data.user_id})`);
  }
  const readOwn = await user.from("trails").select("id").eq("id", trailId);
  if (!readOwn.error && readOwn.data?.length === 1)
    ok("owner can read its own row");
  else bad(`owner read-back failed: ${readOwn.error?.message ?? "not found"}`);

  // 4. RLS isolation: a logged-out client must NOT see the row.
  console.log("\nRLS isolation:");
  const anon = createClient(URL, PUBLISHABLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const anonRead = await anon.from("trails").select("id").eq("id", trailId);
  if (!anonRead.error && (anonRead.data?.length ?? 0) === 0)
    ok("logged-out client cannot read the row (RLS blocks non-owners)");
  else if (anonRead.data?.length)
    bad("SECURITY: logged-out client READ the row — RLS is not protecting data");
  else ok(`anon read errored (also fine): ${anonRead.error?.message}`);

  // 5. Upsert on composite-key tables.
  console.log("\nUpsert (reactions, user_kv):");
  const rx = await user
    .from("reactions")
    .upsert(
      { card_id: "__verify__", reaction: "like" },
      { onConflict: "user_id,card_id" },
    );
  if (!rx.error) ok("reactions upsert");
  else bad(`reactions upsert: ${rx.error.message}`);

  const kv = await user
    .from("user_kv")
    .upsert(
      { key: "__verify__", value: { hello: "world" } },
      { onConflict: "user_id,key" },
    );
  if (!kv.error) ok("user_kv upsert");
  else bad(`user_kv upsert: ${kv.error.message}`);

  // 6. The write limits (migration 0007). RLS answers "whose row is this" and
  // nothing else, so without these an ordinary account can fill the database:
  // measured before they existed, an 8 MB row was accepted in 2 seconds and 500
  // rows landed in 3. These checks are what say the migration has been applied.
  console.log("\nWrite limits (0007):");
  const big = (n) => [{ pad: "x".repeat(n) }];

  const okSize = await user
    .from("trails")
    .insert({ id: randomUUID(), name: "__verify_size_ok__", steps: big(41_000) })
    .select("id")
    .single();
  if (!okSize.error) {
    ok("a realistic trail (41 KB, the largest real one) is accepted");
    await user.from("trails").delete().eq("id", okSize.data.id);
  } else {
    bad(`a realistic 41 KB trail was REJECTED: ${okSize.error.message}`);
  }

  const tooBig = await user
    .from("trails")
    .insert({ id: randomUUID(), name: "__verify_size_bad__", steps: big(8_000_000) });
  if (tooBig.error) ok("an 8 MB trail is refused (trails_steps_size)");
  else {
    bad(
      "an 8 MB trail was ACCEPTED — migration 0007 is not applied" +
        "\n      → paste supabase/migrations/0007_write_limits.sql into Studio → SQL Editor → Run",
    );
    await user.from("trails").delete().eq("name", "__verify_size_bad__");
  }

  const kvTooBig = await user
    .from("user_kv")
    .upsert(
      { key: "__verify_big__", value: { pad: "x".repeat(8_000_000) } },
      { onConflict: "user_id,key" },
    );
  if (kvTooBig.error) ok("an 8 MB user_kv blob is refused (user_kv_value_size)");
  else {
    bad("an 8 MB user_kv blob was ACCEPTED — migration 0007 is not applied");
    await user.from("user_kv").delete().eq("key", "__verify_big__");
  }

  // The per-user ROW cap on user_kv (0008). Unlike 0007's 500-row cap on trails
  // this one is cheap to prove — the cap is 20 — so it IS checked, row by row,
  // and the loop stops the moment the database says no.
  //
  // The gap it guards: `user_kv`'s primary key is (user_id, key) and `key` is
  // free-form, so before 0008 a browser could invent keys without limit and pay
  // the 256 KB ceiling separately on each. Measured at the time: 300 invented
  // keys accepted in 236ms, and ~5 MB of them in 2.4s.
  let accepted = 0;
  let refusedAt = null;
  for (let i = 0; i < 25; i++) {
    const r = await user
      .from("user_kv")
      .insert({ key: `__verify_cap_${i}__`, value: { i } });
    if (r.error) {
      refusedAt = i;
      break;
    }
    accepted++;
  }
  if (refusedAt === null) {
    bad(
      `25 invented user_kv keys were all ACCEPTED — migration 0008 is not applied` +
        "\n      → paste supabase/migrations/0008_user_kv_row_cap.sql into Studio → SQL Editor → Run",
    );
  } else if (accepted < 10) {
    // Refusing too early would mean an honest reader (four blobs: interests,
    // settings, seen, sessions) could hit the cap, which would stall real sync.
    bad(`the user_kv row cap refused after only ${accepted} rows — too tight for four real blobs`);
  } else {
    ok(`invented user_kv keys are capped (accepted ${accepted}, refused the next)`);
  }
  for (let i = 0; i < 25; i++) {
    await user.from("user_kv").delete().eq("key", `__verify_cap_${i}__`);
  }

  // NOTE what is deliberately NOT checked here: 0007's per-user ROW cap (500).
  // Proving it needs 500 inserts, which is slow over the network and would leave
  // a mess in the real project if this script were interrupted part-way. The two
  // size checks above are what tell you 0007 landed; if they pass, the triggers
  // in the same file are there too.
  //
  // It WAS exercised, against a scratch Postgres while the migration was
  // written — row 500 accepted, 501 refused, a bulk insert of 100 refused, and a
  // second account unaffected by the first one's cap. That was a throwaway rig,
  // not something committed, so treat this as a record of how the number was
  // arrived at rather than as a test you can re-run from here. The measurements
  // are written up in plan.md, Phase 33D.

  // Cleanup (hard-delete the verify rows).
  await user.from("trails").delete().eq("id", trailId);
  await user.from("reactions").delete().eq("card_id", "__verify__");
  await user.from("user_kv").delete().eq("key", "__verify__");
  // And the account itself, which cascades anything missed above.
  await admin.auth.admin.deleteUser(uid);

  console.log(
    failures
      ? `\n\x1b[31m${failures} check(s) failed.\x1b[0m\n`
      : "\n\x1b[32mAll checks passed — the backend is ready.\x1b[0m\n",
  );
}

main()
  .then(() => process.exit(failures ? 1 : 0))
  .catch((e) => {
    console.error("\nUnexpected error:", e);
    process.exit(1);
  });
