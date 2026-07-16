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
//
// Uses the SERVER-ONLY secret key (service role, bypasses RLS) to provision a
// confirmed test user, and the publishable key as a real end-user would.

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SECRET = process.env.SUPABASE_SECRET_KEY;
const PUBLISHABLE =
  process.env.SUPABASE_PUBLISH_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const EMAIL = process.env.SUPABASE_EMAIL;
const PASSWORD = process.env.SUPABASE_PASSWORD;

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
  if (!EMAIL) missing.push("SUPABASE_EMAIL");
  if (!PASSWORD) missing.push("SUPABASE_PASSWORD");
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
  const created = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
  });
  if (created.error && !/already/i.test(created.error.message)) {
    bad(`create test user: ${created.error.message}`);
    return;
  }
  ok(`test user ready (${EMAIL})`);

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

  // Cleanup (hard-delete the verify rows).
  await user.from("trails").delete().eq("id", trailId);
  await user.from("reactions").delete().eq("card_id", "__verify__");
  await user.from("user_kv").delete().eq("key", "__verify__");

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
