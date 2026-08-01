// Drift · Phase 27 — public share link verification.
//
// Run:  npm run verify:share
//
// A public share is readable by anyone holding its token, which makes it the
// only table in Drift that an ANONYMOUS caller can reach. That inverts the usual
// question. Everywhere else the test is "can a stranger read this row"; here the
// answer is deliberately yes, so the test has to be sharper:
//
//   1. the table and the get_public_share() function exist
//   2. an owner can create a link and see it in their own list
//   3. ⚠️ an anonymous client CANNOT `select` the table at all. This is THE
//      test in this file. A share is protected only by its token being secret,
//      so any path that lists rows without one destroys every link at once.
//   4. an anonymous client CAN read a share by exact token
//   5. a REVOKED token returns nothing, and is indistinguishable from
//   6. an UNKNOWN token, which also returns nothing
//   7. another signed-in user cannot see or revoke someone else's link
//
// Cleans up its rows afterward.

import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SECRET = process.env.SUPABASE_SECRET_KEY;
const PUBLISHABLE =
  process.env.SUPABASE_PUBLISH_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
let failures = 0;
const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const bad = (m) => { failures++; console.log(`  \x1b[31m✗\x1b[0m ${m}`); };

if (!URL || !SECRET || !PUBLISHABLE) {
  console.error("Missing env (need SUPABASE_URL and SUPABASE_SECRET_KEY and SUPABASE_PUBLISH_KEY).");
  process.exit(2);
}

const admin = createClient(URL, SECRET, { auth: { persistSession: false } });
const anon = createClient(URL, PUBLISHABLE, { auth: { persistSession: false } });

// BOTH test users are provisioned here with the secret key and deleted at the
// end. This script deliberately does NOT use SUPABASE_EMAIL / SUPABASE_PASSWORD.
//
// Two reasons, and the second is the serious one. First, that account's password
// has been stale since at least 2026-07-17 and a sign-in failure there looks
// exactly like a real bug in this feature. Second, and worse: this script
// deletes shares belonging to the users it tests, and it deletes one of them
// outright to prove the cascade. Pointing that at the owner's real account is a
// footgun that only has to go off once.
const A_EMAIL = "drift.verify.share.a@example.com";
const B_EMAIL = "drift.verify.share.b@example.com";
const PW = "drift-verify-pw-123!";

// base64url, 22 chars, matching lib/publicshare/link.ts and the SQL constraint.
function token() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Buffer.from(bytes).toString("base64url");
}

async function signedInClient(email, password) {
  const c = createClient(URL, PUBLISHABLE, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`sign in ${email}: ${error.message}`);
  return { client: c, id: data.user.id };
}

const CARD = {
  pageTitle: "Octopus",
  displayTitle: "Octopus",
  extract: "A cephalopod of the order Octopoda.",
  sourceUrl: "https://en.wikipedia.org/wiki/Octopus",
  source: "wikipedia",
};

async function main() {
  console.log(`\nVerifying public share links at ${URL}\n`);

  console.log("Schema:");
  const tbl = await admin.from("public_shares").select("token").limit(1);
  if (tbl.error) {
    bad(
      `public_shares: ${tbl.error.message}` +
        (/does not exist|schema cache/i.test(tbl.error.message)
          ? "\n      → paste supabase/migrations/0004_public_shares.sql into Studio → SQL Editor → Run"
          : ""),
    );
    return;
  }
  ok("public_shares exists");

  const fn = await anon.rpc("get_public_share", { p_token: "nope_nope_nope_nope" });
  if (fn.error) {
    bad(
      `get_public_share(): ${fn.error.message}` +
        "\n      → paste supabase/migrations/0004_public_shares.sql into Studio → SQL Editor → Run",
    );
    return;
  }
  ok("get_public_share() exists and is callable by anon");

  console.log("\nOwner side:");
  for (const email of [A_EMAIL, B_EMAIL]) {
    const created = await admin.auth.admin.createUser({
      email,
      password: PW,
      email_confirm: true,
    });
    if (created.error && !/already/i.test(created.error.message)) {
      bad(`create ${email}: ${created.error.message}`);
      return;
    }
  }
  const A = await signedInClient(A_EMAIL, PW);
  const B = await signedInClient(B_EMAIL, PW);
  await admin.from("public_shares").delete().in("owner_id", [A.id, B.id]);

  const live = token();
  const dead = token();
  const insLive = await A.client
    .from("public_shares")
    .insert({ token: live, owner_id: A.id, kind: "card", payload: CARD });
  const insDead = await A.client
    .from("public_shares")
    .insert({ token: dead, owner_id: A.id, kind: "card", payload: CARD });
  if (insLive.error || insDead.error) {
    bad(`owner insert: ${insLive.error?.message ?? insDead.error?.message}`);
    return;
  }
  ok("owner creates two links");

  const mine = await A.client.from("public_shares").select("token");
  if (!mine.error && mine.data.length === 2) ok("owner sees their own links");
  else bad(`owner list returned ${mine.data?.length} (expected 2)`);

  // Insert as someone else must be refused by the with-check policy.
  const forged = await B.client
    .from("public_shares")
    .insert({ token: token(), owner_id: A.id, kind: "card", payload: CARD });
  if (forged.error) ok("cannot create a link owned by someone else");
  else bad("SECURITY: B created a share owned by A");

  console.log("\nAnonymous side (the part that matters):");

  // 3. THE test. If this ever returns rows, every link in the system is public.
  const sweep = await anon.from("public_shares").select("token,payload");
  if (sweep.error || (sweep.data?.length ?? 0) === 0) {
    ok("anon CANNOT list the table (no enumeration)");
  } else {
    bad(
      `SECURITY: anon listed ${sweep.data.length} share(s) without a token. ` +
        "Every share link in the database is exposed. Check that no anon SELECT policy exists on public_shares.",
    );
  }

  // A signed-in stranger must not be able to enumerate either.
  const bSweep = await B.client.from("public_shares").select("token");
  if ((bSweep.data?.length ?? 0) === 0) ok("another signed-in user sees no links of A's");
  else bad(`SECURITY: B listed ${bSweep.data.length} of A's shares`);

  // 4. Reading by exact token works.
  const read = await anon.rpc("get_public_share", { p_token: live }).maybeSingle();
  if (!read.error && read.data?.payload?.displayTitle === "Octopus") {
    ok("anon reads a share by exact token");
  } else {
    bad(`anon read by token failed: ${read.error?.message ?? "no row"}`);
  }

  // 5 + 6. Revoked and unknown must be the SAME nothing.
  const rev = await A.client
    .from("public_shares")
    .update({ revoked_at: new Date().toISOString() })
    .eq("token", dead);
  if (rev.error) bad(`revoke: ${rev.error.message}`);
  else ok("owner revokes a link");

  const readDead = await anon.rpc("get_public_share", { p_token: dead }).maybeSingle();
  const readUnknown = await anon
    .rpc("get_public_share", { p_token: token() })
    .maybeSingle();
  if (!readDead.data && !readUnknown.data) {
    ok("revoked and unknown tokens are the same nothing");
  } else {
    bad(
      `revoked returned ${JSON.stringify(readDead.data)}, unknown returned ${JSON.stringify(readUnknown.data)}`,
    );
  }

  // 7. A stranger must not be able to revoke A's live link.
  const hijack = await B.client
    .from("public_shares")
    .update({ revoked_at: new Date().toISOString() })
    .eq("token", live)
    .select();
  const stillLive = await anon.rpc("get_public_share", { p_token: live }).maybeSingle();
  if ((hijack.data?.length ?? 0) === 0 && stillLive.data) {
    ok("another user cannot revoke someone else's link");
  } else {
    bad("SECURITY: B revoked A's link");
  }

  console.log("\nDeletion:");
  // The cascade is what makes account deletion reach these rows. Prove it
  // against the real database rather than trusting the DDL.
  const probe = token();
  await B.client
    .from("public_shares")
    .insert({ token: probe, owner_id: B.id, kind: "card", payload: CARD });
  await admin.auth.admin.deleteUser(B.id);
  const afterDelete = await admin.from("public_shares").select("token").eq("token", probe);
  if ((afterDelete.data?.length ?? 0) === 0) ok("deleting a user removes their links (cascade)");
  else bad("Article 17: a deleted user's share links survived");

  await admin.from("public_shares").delete().eq("owner_id", A.id);
  await admin.auth.admin.deleteUser(A.id);
  console.log(
    failures ? `\n\x1b[31m${failures} check(s) failed\x1b[0m\n` : "\n\x1b[32mAll checks passed\x1b[0m\n",
  );
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
