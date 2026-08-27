// ---------------------------------------------------------------------------
// Drift · load-test harness — the burner accounts.
//
//   npm run bots:seed -- --count 50     create (idempotent, safe to re-run)
//   npm run bots:seed -- --list         show what exists
//   npm run bots:teardown               delete every one of them
//
// The hosted app is login-gated, so a swarm needs accounts. This makes them with
// the SERVER-ONLY secret key (never NEXT_PUBLIC_, see CLAUDE.md §4), the same
// admin client /api/account/delete uses, and writes the credentials to
// scripts/bots/.accounts.json (git-ignored).
//
// Three details here are load-bearing, and each one is a thing that goes wrong
// quietly rather than loudly:
//
//   1. `email_confirm: true` — the account is born confirmed, so no confirmation
//      mail is ever generated and a password sign-in returns a session at once.
//
//   2. `app_metadata.welcomed: true` — AuthProvider fires /api/email/welcome on
//      every confirmed sign-in, and that route SENDS VIA RESEND unless this flag
//      is already set. Without it, fifty bots means fifty hard bounces to a
//      .invalid domain charged against a real sending reputation. With it the
//      route answers `{ ok: true, skipped: true }` and sends nothing. This is
//      the single most important line in the file.
//
//   3. `app_metadata.load_bot: true` — the teardown key. Deletion selects on
//      THIS, not on the address pattern, so the teardown cannot reach an account
//      that merely looks like a bot's. Deleting the auth user cascades to
//      entitlements, usage_daily and the Phase 9 sync tables.
//
// Addresses use `@loadtest.invalid`: `.invalid` is reserved by RFC 2606 and is
// guaranteed never to resolve, so even a bug that tried to mail one could not
// reach a real person.
//
// The entitlement row (source 'manual', the branch docs/supporter.md documents
// for exactly this) is what makes supporter_status() return supporter: true, so
// no bot is ever stopped by the daily meter mid-run.
// ---------------------------------------------------------------------------

import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const ACCOUNTS_FILE = fileURLToPath(new URL("./.accounts.json", import.meta.url));

const URL_ = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SECRET = process.env.SUPABASE_SECRET_KEY;

/** The address every bot account uses. Reserved TLD: never deliverable. */
export const BOT_DOMAIN = "loadtest.invalid";
export const botEmail = (i) => `drift-bot-${String(i).padStart(3, "0")}@${BOT_DOMAIN}`;

const green = (m) => `\x1b[32m${m}\x1b[0m`;
const red = (m) => `\x1b[31m${m}\x1b[0m`;
const dim = (m) => `\x1b[2m${m}\x1b[0m`;

function admin() {
  if (!URL_ || !SECRET) {
    console.error(
      red("Missing env: SUPABASE_URL and SUPABASE_SECRET_KEY are required."),
    );
    console.error(
      "They are in .env already; run through npm so --env-file is applied.",
    );
    process.exit(2);
  }
  return createClient(URL_, SECRET, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Read the saved credentials, or an empty list. */
export async function loadAccounts() {
  try {
    const raw = await readFile(ACCOUNTS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.accounts) ? parsed.accounts : [];
  } catch {
    return [];
  }
}

/**
 * Every bot user currently in the project.
 *
 * Pages through listUsers because the default page is 50 and a 50-bot run sits
 * exactly on that boundary — the kind of off-by-one that would make a teardown
 * silently leave accounts behind.
 */
async function listBotUsers(sb) {
  const found = [];
  for (let page = 1; ; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const users = data?.users ?? [];
    for (const u of users) {
      if (u.app_metadata?.load_bot) found.push(u);
    }
    if (users.length < 200) break;
  }
  return found;
}

async function seed(count) {
  const sb = admin();
  console.log(`\nSeeding ${count} bot accounts at ${URL_}\n`);

  const existing = await loadAccounts();
  const byEmail = new Map(existing.map((a) => [a.email, a]));
  const accounts = [];
  let created = 0;
  let reused = 0;

  for (let i = 0; i < count; i++) {
    const email = botEmail(i);
    const prior = byEmail.get(email);
    // A saved password is the only way back into an existing account (the admin
    // API will not tell us one), so reuse it when we have it rather than
    // creating a second, unreachable account.
    const password = prior?.password ?? `bot-${randomBytes(12).toString("hex")}`;

    const { data, error } = await sb.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { welcomed: true, load_bot: true },
    });

    let userId = data?.user?.id;
    if (error) {
      // Already there from an earlier seed. Find it, and re-assert both flags
      // and the password — an account created before this script grew the
      // `welcomed` stamp would otherwise still trigger a Resend send.
      const all = await listBotUsers(sb);
      const found = all.find((u) => u.email === email);
      if (!found) {
        const { data: page } = await sb.auth.admin.listUsers({ perPage: 200 });
        const any = page?.users?.find((u) => u.email === email);
        if (!any) {
          console.log(`  ${red("✗")} ${email}: ${error.message}`);
          continue;
        }
        userId = any.id;
      } else {
        userId = found.id;
      }
      await sb.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
        app_metadata: { welcomed: true, load_bot: true },
      });
      reused++;
    } else {
      created++;
    }

    if (!userId) continue;

    // The supporter unlock, so the daily meter never interrupts a run.
    // upsert, not insert: re-seeding must not fail on the primary key.
    const { error: entErr } = await sb
      .from("entitlements")
      .upsert(
        { user_id: userId, kind: "supporter", source: "manual", revoked_at: null },
        { onConflict: "user_id" },
      );
    if (entErr) console.log(`  ${red("✗")} entitlement for ${email}: ${entErr.message}`);

    accounts.push({ index: i, email, password, userId });
  }

  await writeFile(
    ACCOUNTS_FILE,
    `${JSON.stringify({ createdAt: new Date().toISOString(), accounts }, null, 2)}\n`,
    "utf8",
  );

  console.log(
    `  ${green("✓")} ${created} created, ${reused} reused, ${accounts.length} usable`,
  );
  console.log(dim(`  credentials → scripts/bots/.accounts.json (git-ignored)`));

  // Prove the two flags that matter, on a real row read back from the server
  // rather than on what we believe we sent.
  if (accounts.length) {
    const { data } = await sb.auth.admin.getUserById(accounts[0].userId);
    const meta = data?.user?.app_metadata ?? {};
    const confirmed = Boolean(data?.user?.email_confirmed_at);
    console.log(
      `  ${meta.welcomed ? green("✓") : red("✗")} welcomed stamp set ` +
        `${dim("(so /api/email/welcome sends nothing)")}`,
    );
    console.log(`  ${meta.load_bot ? green("✓") : red("✗")} load_bot stamp set`);
    console.log(`  ${confirmed ? green("✓") : red("✗")} email pre-confirmed`);
    const { data: ent } = await sb
      .from("entitlements")
      .select("source, revoked_at")
      .eq("user_id", accounts[0].userId)
      .maybeSingle();
    console.log(
      `  ${ent && !ent.revoked_at ? green("✓") : red("✗")} supporter unlock granted ` +
        `${dim(`(source: ${ent?.source ?? "none"})`)}`,
    );
  }
  console.log();
}

async function teardown() {
  const sb = admin();
  console.log(`\nRemoving bot accounts at ${URL_}\n`);
  const users = await listBotUsers(sb);
  if (!users.length) {
    console.log(`  ${green("✓")} nothing to remove\n`);
    return;
  }
  let gone = 0;
  for (const u of users) {
    // Selected on app_metadata.load_bot, never on the address — so this cannot
    // reach a real account even if someone signed up with a .invalid address.
    const { error } = await sb.auth.admin.deleteUser(u.id);
    if (error) console.log(`  ${red("✗")} ${u.email}: ${error.message}`);
    else gone++;
  }
  console.log(`  ${green("✓")} deleted ${gone} of ${users.length}`);

  // Prove the cascade rather than trusting the schema: an orphan entitlement row
  // would mean a future account could inherit an unlock it never bought.
  const ids = users.map((u) => u.id);
  for (const table of ["entitlements", "usage_daily"]) {
    const { count, error } = await sb
      .from(table)
      .select("*", { count: "exact", head: true })
      .in("user_id", ids);
    if (error) continue;
    console.log(
      `  ${count === 0 ? green("✓") : red("✗")} ${table}: ${count ?? "?"} rows left behind`,
    );
  }
  await writeFile(
    ACCOUNTS_FILE,
    `${JSON.stringify({ createdAt: new Date().toISOString(), accounts: [] }, null, 2)}\n`,
    "utf8",
  );
  console.log();
}

async function list() {
  const sb = admin();
  const users = await listBotUsers(sb);
  const saved = await loadAccounts();
  console.log(
    `\n${users.length} bot account(s) in the project, ${saved.length} with saved credentials\n`,
  );
  for (const u of users.slice(0, 10)) {
    console.log(`  ${u.email}  ${dim(u.id)}`);
  }
  if (users.length > 10) console.log(dim(`  … and ${users.length - 10} more`));
  console.log();
}

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

// Only act when this file IS the program. run.mjs imports `loadAccounts` from
// here, and without this guard that import re-ran the seeder as a side effect of
// starting a load test — which quietly created accounts nobody asked for every
// time a run began.
const invokedDirectly =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (invokedDirectly) {
  if (process.argv.includes("--teardown")) await teardown();
  else if (process.argv.includes("--list")) await list();
  else await seed(Math.max(1, Number(arg("count", "10")) || 10));
}
