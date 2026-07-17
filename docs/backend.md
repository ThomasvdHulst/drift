# Drift — Backend, Accounts & Cloud Sync (Phase 9)

This document covers the optional cloud backend added in Phase 9: how it's set up, how
sync works, and — importantly — **what to look at when you want to scale beyond "me + a few
friends."** If you never configure Supabase, none of this runs and Drift is exactly the
local-only app it always was.

> **Core principle carried in:** the backend is *optional at the codebase level*. When Supabase
> isn't configured (a fresh local clone / CI), Drift is byte-for-byte the old fully-local app and
> the backend being down never breaks the core drift loop (CLAUDE.md §4). **When it IS configured
> (the hosted app, Phase 13), an account is required** — a logged-out visitor sees a calm sign-in
> gate instead of drifting anonymously, and each account's data is private to it (local data is
> cleared on sign-out). The anti-slot-machine principles (§2) still bind everything built on top.

---

## 1. What the backend is

- **[Supabase](https://supabase.com)** — hosted Postgres + Auth + Row-Level Security (RLS).
  One integrated backend that serves the web app now and a future mobile app (Supabase has
  first-class React Native SDKs).
- The browser talks to Supabase **directly** (this is a sanctioned exception to CLAUDE.md
  §4's "proxy everything," which exists for Wikipedia/Ollama etiquette + CORS). Supabase is
  *designed* for direct browser access secured by the **publishable key + RLS** — that is its
  security model. The **secret key never ships to the browser**.

## 2. Environment variables

Put these in the git-ignored `.env` (see `.env.local.example` for the template):

| Variable | Where it's used | Secret? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | browser (auth + sync) | no |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | browser (auth + sync) | no — RLS protects data |
| `SUPABASE_URL` | `scripts/verify-supabase.mjs` | no |
| `SUPABASE_SECRET_KEY` | `scripts/verify-supabase.mjs` **only** | **YES — never `NEXT_PUBLIC_`** |
| `SUPABASE_EMAIL` / `SUPABASE_PASSWORD` | a test account for the verify script | test creds |

Only the two `NEXT_PUBLIC_*` vars reach the app. The secret key bypasses RLS and is used
solely by the verification script.

## 3. One-time setup (per Supabase project)

1. **Create the schema:** open Supabase Studio → **SQL Editor** → paste and **Run** each
   migration in order (all idempotent — safe to re-run):
   - `supabase/migrations/0001_phase9_schema.sql` (accounts & sync)
   - `supabase/migrations/0002_phase10_social.sql` (profiles + friend graph)
   - `supabase/migrations/0003_phase10_shares.sql` (sharing / inbox)
2. **Instant sign-up for personal use:** Authentication → **Sign In / Providers** → **Email**
   → turn **off** "Confirm email". (Sign-*in* works regardless; this only affects the in-app
   *Create account* flow. For public signups, leave confirmation **on** — see §7.)
3. **Verify:** `npm run verify:supabase` (accounts/sync) and `npm run verify:social`
   (profiles, friend requests, `are_friends`, friends-only sharing + RLS isolation).

## 4. Data model

Three tables mirror the local IndexedDB stores, one owner per row, all guarded by RLS
(`user_id = auth.uid()`), all with a server-set `updated_at` (via a trigger) and a
soft-delete `deleted` flag.

| Table | Shape | Local store(s) |
|---|---|---|
| `trails` | row per trail (`id`, `name`, `realm`, `liked`, `created_at_ms`, `steps` jsonb) | `trails` |
| `reactions` | row per (`user_id`, `card_id`) → `reaction` | `reactions` |
| `user_kv` | row per (`user_id`, `key`) → `value` jsonb | `settings`, `interests`, `seen`, `sessions` |

`topicsCache` is **never synced** — it's a regenerable API cache and stays local.

**Social tables (Phase 10)** are *not* part of local-first sync — they're live-fetched (see
§5b):

| Table | Shape | Purpose |
|---|---|---|
| `profiles` | `id`=`auth.uid()`, unique `handle` (`^[a-z0-9_]{3,30}$`), `display_name` | how friends find you |
| `friend_requests` | `requester_id`, `addressee_id`, `status ∈ {pending,accepted,declined}`, `unique(requester,addressee)` | mutual friendship (friends = an `accepted` row, either direction) |
| `shares` | `sender_id`, `recipient_id`, `kind ∈ {trail,card}`, `payload jsonb` (snapshot), `note`, `read` | a friend-to-friend inbox item |

Plus `are_friends(u1, u2) → bool` (a `stable security definer` function) used inside the
`shares` insert policy to enforce **friends-only sending in the database**, not just the UI.

## 5. How sync works (`src/lib/sync/*` + the `storage.ts` seam)

**Local-first.** IndexedDB stays the instant local cache; a thin background **replicator**
(`src/lib/sync/replicator.ts`) pushes/pulls to Postgres. The rest of the app keeps calling
`storage.ts` unchanged.

- **The seam.** Every mutation in `storage.ts` records the change in a durable **journal**
  (`syncState` key) and emits a change event. Journaling is on only when Supabase is
  configured, so an unconfigured app writes nothing extra.
- **Push** (debounced ~1.5 s after a local change): uploads journaled record upserts +
  soft-delete tombstones, then clears exactly what it pushed.
- **Pull** (on sign-in / window focus / tab-visible / regained connectivity): fetches rows
  changed since a per-store cursor and merges them locally. Focus/online do a full pull+push
  so an offline edit flushes on reconnect.
- **Merge** (pure, unit-tested in `src/lib/sync/merge.ts`):
  - *Collections* (`trails`, `reactions`): last-write-wins by the server's `updated_at`; a
    **dirty** (un-pushed) local record is never overwritten by a pull; deletes travel as
    tombstones.
  - *Blobs*: `interests` / `settings` are whole-value **LWW**; `seen` / `sessions` are
    **unioned** across devices (so two devices' lists combine instead of one clobbering the
    other).
- **First sign-in adoption:** a signed-out user's whole local world is adopted into the new
  account. (Only *non-empty* blobs are pushed, so a fresh second device pulls the account's
  values instead of overwriting them with blanks.)
- **Sign-out** clears the session but **leaves all local data intact** — Drift keeps working
  locally, and un-pushed changes sync on the next sign-in.

### Known limitations (fine for personal + a few friends)
- **Conflicts are last-write-wins** by server-stamped time. If the *same* trail is edited on
  two devices while both are offline, the one that syncs later wins. Trails are mostly
  append-only, so this is rare in practice.
- **One account at a time per browser.** As of Phase 13, **sign-out wipes this device's local
  data** (after a best-effort flush of pending changes), and **switching to a different account
  clears the previous account's local world before pulling the new one** — so no account's trails
  linger for the next person. Edge case: a local edit made *offline* and never synced is lost by
  the sign-out wipe (the flush can't reach the server). Rare and acceptable at personal scale; if
  it matters, sign out while online.
- **`seen` / `sessions` unions** may keep a few extra entries across devices — harmless (seen
  is a dedup cache with intentional FIFO decay; sessions feed only descriptive stats).

---

## 5b. Social layer (Phase 10) — `src/lib/social/*`

Unlike personal stores, social data is **live-fetched** (interacting with others is inherently
online) through `src/lib/social/client.ts` — the sync replicator is untouched. Every call is
**fully guarded** (`getSupabase()` null + try/caught → empty/no-op), so the backend being down
degrades social features to calm empty states and never breaks the core loop (§4).

- **Discovery is handle-only.** `profiles` is readable by any authenticated user (needed to
  resolve handles → names), but the app only ever searches by `handle` — there's no browsable
  name directory.
- **Friendship is mutual.** A request → the addressee accepts. `are_friends()` gates who can
  send to whom. Pure helpers in `src/lib/social/{handles,friends}.ts` (validation + relationship
  derivation) are unit-tested.
- **Shares carry a self-contained snapshot** (a trail with its steps, or a card), so the
  recipient never needs read access to the sender's own rows, and later edits don't leak.
- **"Continue theirs" bridges back to sync:** continuing/adding a received trail creates a
  *fresh local trail* owned by the recipient (`sharePayloadToLocalTrail`), which then syncs via
  Phase 9 like any other trail. This reuses the existing `?continue=` path — no feed changes.
- **Calm by construction (§2):** the inbox is a finite, newest-first list (**not** a feed — that's
  Phase 11); a single quiet sage dot signals "something new" (no red badges, no counts, no
  polling — re-checked on focus); sharing is a deliberate pick-a-friend action.

---

## 6. Scaling Drift — what to look at, and when

Everything below stays comfortably within **free tiers** at "me + a few friends" scale.
Approximate limits (verify current numbers at <https://supabase.com/pricing>):

**Supabase Free (per project), ~2025:** ~500 MB Postgres, ~5 GB egress/mo, ~50,000 monthly
active auth users, up to 2 active projects per org, and **projects pause after ~7 days of
inactivity**. Drift's data is tiny (a few hundred trails ≈ well under a MB), so storage/egress
won't be the constraint for a long time.

When you outgrow "a few friends", look at these, roughly in order:

1. **Auth email deliverability (the first real limit).** Supabase's built-in email sender is
   rate-limited (a few messages/hour) and meant for testing. The moment you rely on
   confirmation emails, password resets, or magic links for real users, **configure a custom
   SMTP provider** (Resend, Postmark, SendGrid, AWS SES) in Auth → Settings. Cheap/free at
   low volume.
2. **Project pausing.** The free tier pauses idle projects. For anything friends actually rely
   on, upgrade to **Pro (~$25/mo)** — no pausing, bigger DB/egress, daily backups, higher MAU.
3. **Turn signups on safely (see §7).** Before opening the door, re-audit RLS and decide
   invite-only vs open.
4. **Blob → rows.** `interests`/`settings`/`seen`/`sessions` live as JSON blobs in `user_kv`
   (whole-value sync). If any grows large or needs per-record merge/query (e.g. `seen` gets
   huge, or you want to query sessions server-side for analytics), promote it to its own
   row-level table like `trails`/`reactions`.
5. **A real sync engine.** The custom replicator is deliberately lean. If you need
   **real-time** updates, robust multi-device conflict resolution, or large offline datasets,
   adopt a purpose-built engine — **[PowerSync](https://powersync.com)**,
   **[ElectricSQL](https://electric-sql.com)**, or **[RxDB + rxdb-supabase](https://github.com/marceljuenemann/rxdb-supabase)**.
   Supabase **Realtime** is the lightweight middle option (subscribe to row changes) if you
   just want live updates without a full engine.
6. **Connection & rate limits.** Because the app uses PostgREST (HTTP) + the publishable key,
   Supabase handles pooling. If you ever add direct Postgres connections (server jobs,
   analytics), use the **Supavisor** pooler connection string. Watch API rate limits under
   heavy fan-out; our sync is low-volume by design.
7. **Indexes & queries.** Sync pulls use `(user_id, updated_at)` indexes (already created).
   Add indexes as new query patterns appear (e.g. Phase 10 sharing/feed queries).
8. **Backups.** Free tier backups are limited; Pro adds daily backups + PITR add-ons. Worth it
   once other people's data lives here.
9. **Image hosting/CDN.** Card images are currently hotlinked from Wikimedia / Art Institute
   (no storage cost). If you ever host your own images, use **Supabase Storage** (+ its CDN)
   and mind the storage/egress tiers.
10. **Social at scale (Phase 10+).** Before opening friends/sharing to strangers: add
    **blocking + report/abuse** controls and rate-limit friend requests + shares (an Edge
    Function or a `count`-based check); index `profiles.handle` (done) and consider a trigram
    index for fuzzy handle search; batch any future notifications into a **digest** (never
    per-event bait — §2) and gate them behind opt-in; and, for a real "feed" (Phase 11), page
    it finitely — never an infinite auto-loading stream.

---

## 7. Auth methods (email+password, OAuth, verification, reset)

All auth routes through `AuthProvider` (`useAuth`), secured by **PKCE** (`flowType: "pkce"` in
`client.ts`); `detectSessionInUrl` does the code→session exchange client-side, so there's no server
callback route. What's wired:

- **Email + password** — `signUp` (with `emailRedirectTo`) / `signInWithPassword`.
- **Email verification** — turn **Auth → Providers → Email → "Confirm email" ON**; sign-up then
  returns no session and the app shows a "check your email" panel (with a Resend action). Needs
  custom SMTP (§6.1) to reach non-team users.
- **Google / Apple OAuth** — `signInWithProvider` → `signInWithOAuth({ provider, options: { redirectTo }})`.
  Enable the provider in Auth → Providers (Google: OAuth Client ID + secret from Google Cloud
  Console, Authorized redirect URI = the Supabase callback URL; Apple: needs a paid Apple Developer
  account + Services ID/key). Buttons render **only** for providers listed in
  **`NEXT_PUBLIC_OAUTH_PROVIDERS`** (comma list, e.g. `google` or `google,apple`) — so you never
  show a button for a provider that isn't set up.
- **Password reset** — `requestPasswordReset` → `resetPasswordForEmail(email, { redirectTo: "…/account/reset" })`;
  the `/account/reset` page sets the new password via `updatePassword` → `updateUser({ password })`.
- **Change password (signed in)** — the "Change password" section on `/account` (same `updatePassword`);
  enable Auth → **"Secure password change"** for a re-authentication step.
- **Opening signups to others:** keep **"Confirm email" ON**, configure **custom SMTP** (§6.1),
  consider invite-only / allowed-domain gating, and re-audit every RLS policy (`user_id = auth.uid()`).

## 8. Files

- `src/lib/supabase/client.ts` — graceful singleton (null ⇒ local-only).
- `src/components/AuthProvider.tsx` — `useAuth()`; starts/stops the replicator with the session.
- `src/app/account/page.tsx`, `src/components/AccountButton.tsx` — the account UI.
- `src/lib/sync/merge.ts` — pure merge (unit-tested). `src/lib/sync/replicator.ts` — the replicator.
- `src/lib/storage.ts` — the persistence seam (journal + cursors + `applyRemote*`).
- `src/lib/social/*` — social layer: `handles.ts` + `friends.ts` + `share.ts` (pure, tested),
  `client.ts` (graceful live-fetch: profiles, friends, shares, badge).
- `src/app/friends/page.tsx`, `src/app/inbox/page.tsx`, `src/components/ShareToFriend.tsx` — social UI.
- `supabase/migrations/0001_phase9_schema.sql` (accounts/sync), `0002_phase10_social.sql`
  (profiles + friends), `0003_phase10_shares.sql` (sharing) — schema + RLS + triggers.
- `scripts/verify-supabase.mjs` (`npm run verify:supabase`), `scripts/verify-social.mjs`
  (`npm run verify:social`).
