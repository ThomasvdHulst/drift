// Drift · Phase 10 — social backend verification (friend graph; M27).
//
// Run:  npm run verify:social
//
// Uses the secret key to provision two extra confirmed test users (B, C), then
// acts as real end-users (publishable key) to prove:
//   1. profiles upsert + handle uniqueness
//   2. friend request → the addressee (and only the parties) can see it
//   3. an unrelated authenticated user (C) sees NONE of it (RLS isolation)
//   4. accept → are_friends(A,B) is true
// Cleans up its rows + the extra test users afterward.

import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SECRET = process.env.SUPABASE_SECRET_KEY;
const PUBLISHABLE =
  process.env.SUPABASE_PUBLISH_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const EMAIL = process.env.SUPABASE_EMAIL;
const PASSWORD = process.env.SUPABASE_PASSWORD;

let failures = 0;
const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const bad = (m) => { failures++; console.log(`  \x1b[31m✗\x1b[0m ${m}`); };

if (!URL || !SECRET || !PUBLISHABLE || !EMAIL || !PASSWORD) {
  console.error("Missing env (need SUPABASE_URL/SECRET_KEY/PUBLISH_KEY/EMAIL/PASSWORD).");
  process.exit(2);
}

const admin = createClient(URL, SECRET, { auth: { persistSession: false } });

const B_EMAIL = "drift.verify.b@example.com";
const C_EMAIL = "drift.verify.c@example.com";
const PW = "drift-verify-pw-123!";

async function ensureUser(email, password) {
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error && !/already/i.test(created.error.message)) {
    throw new Error(`create ${email}: ${created.error.message}`);
  }
}

async function signedInClient(email, password) {
  const c = createClient(URL, PUBLISHABLE, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`sign in ${email}: ${error.message}`);
  return { client: c, id: data.user.id };
}

async function main() {
  console.log(`\nVerifying social backend at ${URL}\n`);

  // Tables exist?
  console.log("Tables:");
  for (const t of ["profiles", "friend_requests", "shares"]) {
    const { error } = await admin.from(t).select("*").limit(1);
    if (error) {
      bad(`${t}: ${error.message}` +
        (/does not exist|schema cache/i.test(error.message)
          ? "\n      → paste supabase/migrations/0002_phase10_social.sql into Studio → SQL Editor → Run"
          : ""));
    } else ok(`${t} exists`);
  }
  if (failures) return;

  console.log("\nUsers + profiles:");
  await ensureUser(EMAIL, PASSWORD);
  await ensureUser(B_EMAIL, PW);
  await ensureUser(C_EMAIL, PW);
  const A = await signedInClient(EMAIL, PASSWORD);
  const B = await signedInClient(B_EMAIL, PW);
  const C = await signedInClient(C_EMAIL, PW);
  ok("three test users signed in");

  // Clean any prior verify state between these users.
  await admin.from("friend_requests").delete().in("requester_id", [A.id, B.id, C.id]);
  await admin.from("friend_requests").delete().in("addressee_id", [A.id, B.id, C.id]);

  const up = async (c, id, handle) =>
    c.from("profiles").upsert({ id, handle, display_name: handle }, { onConflict: "id" });
  const ea = (await up(A.client, A.id, "verify_a")).error;
  const eb = (await up(B.client, B.id, "verify_b")).error;
  await up(C.client, C.id, "verify_c");
  if (!ea && !eb) ok("profiles upsert (own row)");
  else bad(`profile upsert: ${ea?.message ?? ""} ${eb?.message ?? ""}`);

  // Handle uniqueness: C tries to take verify_a → must fail.
  const dup = await C.client.from("profiles").upsert({ id: C.id, handle: "verify_a" }, { onConflict: "id" });
  if (dup.error) ok("duplicate handle rejected (unique)");
  else bad("SECURITY/DATA: duplicate handle was allowed");
  await up(C.client, C.id, "verify_c"); // restore C's handle

  console.log("\nFriend request + RLS:");
  const ins = await A.client
    .from("friend_requests")
    .insert({ requester_id: A.id, addressee_id: B.id, status: "pending" })
    .select()
    .single();
  if (ins.error) { bad(`A→B request insert: ${ins.error.message}`); return; }
  ok("A sends B a friend request");

  const bSees = await B.client.from("friend_requests").select("id,status");
  if (!bSees.error && bSees.data?.some((r) => r.id === ins.data.id))
    ok("addressee B can see the request");
  else bad("addressee B cannot see the request");

  const cSees = await C.client.from("friend_requests").select("id");
  if (!cSees.error && (cSees.data?.length ?? 0) === 0)
    ok("unrelated user C sees NO requests (RLS isolation)");
  else bad(`RLS: unrelated user C saw ${cSees.data?.length} request(s)`);

  // C must not be able to accept someone else's request.
  const cHijack = await C.client
    .from("friend_requests")
    .update({ status: "accepted" })
    .eq("id", ins.data.id)
    .select();
  if ((cHijack.data?.length ?? 0) === 0)
    ok("non-addressee cannot accept the request (RLS)");
  else bad("SECURITY: a non-addressee accepted the request");

  const accept = await B.client
    .from("friend_requests")
    .update({ status: "accepted" })
    .eq("id", ins.data.id)
    .select();
  if (!accept.error && accept.data?.length === 1) ok("addressee B accepts");
  else bad(`accept failed: ${accept.error?.message}`);

  const rpc = await A.client.rpc("are_friends", { u1: A.id, u2: B.id });
  if (!rpc.error && rpc.data === true) ok("are_friends(A,B) = true");
  else bad(`are_friends check: ${rpc.error?.message ?? rpc.data}`);

  console.log("\nSharing + RLS:");
  // A (friend of B) can send to B.
  const send = await A.client
    .from("shares")
    .insert({ sender_id: A.id, recipient_id: B.id, kind: "card", payload: { displayTitle: "Octopus" }, note: "hi" })
    .select()
    .single();
  if (!send.error) ok("friend A can send B a share");
  else bad(`friend send failed: ${send.error.message}`);

  // B can read the share; A (sender) can also see it; nobody else.
  const bInbox = await B.client.from("shares").select("id,kind").eq("recipient_id", B.id);
  if (!bInbox.error && bInbox.data?.some((s) => s.id === send.data?.id))
    ok("recipient B sees the share");
  else bad("recipient B cannot see the share");

  // C is NOT B's friend → the DB must reject the send (not just the UI).
  const cSend = await C.client
    .from("shares")
    .insert({ sender_id: C.id, recipient_id: B.id, kind: "card", payload: { displayTitle: "x" } });
  if (cSend.error) ok("non-friend C is BLOCKED from sending to B (RLS)");
  else bad("SECURITY: a non-friend sent a share");

  // C cannot read B's shares either.
  const cInbox = await C.client.from("shares").select("id").eq("recipient_id", B.id);
  if ((cInbox.data?.length ?? 0) === 0) ok("non-recipient C sees no shares (RLS)");
  else bad(`RLS: C saw ${cInbox.data?.length} of B's shares`);

  // Cleanup shares
  await admin.from("shares").delete().in("sender_id", [A.id, B.id, C.id]);

  // Cleanup
  console.log("\nCleanup:");
  await admin.from("friend_requests").delete().in("requester_id", [A.id, B.id, C.id]);
  await admin.from("profiles").delete().in("id", [B.id, C.id]);
  await admin.auth.admin.deleteUser(B.id);
  await admin.auth.admin.deleteUser(C.id);
  ok("removed test rows + extra users");

  console.log(
    failures
      ? `\n\x1b[31m${failures} check(s) failed.\x1b[0m\n`
      : "\n\x1b[32mAll social checks passed.\x1b[0m\n",
  );
}

main()
  .then(() => process.exit(failures ? 1 : 0))
  .catch((e) => { console.error("\nUnexpected error:", e.message); process.exit(1); });
