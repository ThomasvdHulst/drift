-- Drift · Phase 27 (M1) — Public share links
-- Run once: Supabase Studio → SQL Editor → paste → Run. Safe to re-run.
-- Depends on 0001 (set_updated_at()).
--
-- WHAT THIS IS, AND HOW IT DIFFERS FROM `shares` (0003).
--
-- `shares` is friend-to-friend: an inbox item whose insert policy calls
-- are_friends(), so content can only ever reach a mutual friend, enforced by the
-- database rather than the interface. This table is the opposite by design: a
-- row here is readable by ANYONE holding its token, including someone with no
-- account, because the whole point is to send a card or a trail to a person
-- outside Drift (a WhatsApp message, usually).
--
-- Both carry a self-contained SNAPSHOT rather than a reference, so the reader
-- never needs access to the owner's own RLS-protected rows and a later edit by
-- the owner does not change what was sent.
--
-- ⚠️ DSA CONSEQUENCE, recorded here because this table is what causes it.
-- Sharing that only reaches mutual friends is outside the DSA definition of an
-- "online platform": Recital 14 excludes "closed groups consisting of a finite
-- number of pre-determined persons", and are_friends() made that a database
-- fact. A forwardable link is not a closed group, and Recital 14 adds that
-- requiring registration does not help where admission is automatic. So a
-- public share makes Drift an online platform. The practical delta is small,
-- because DSA Article 19 excludes micro and small enterprises from Articles 20
-- to 28 (bar 24(3)), and Articles 11 to 18 already applied. But /terms says
-- which of these Drift is, and it has to stay true. See src/lib/terms.ts.

-- ---------------------------------------------------------------------------
-- public_shares — one row per link the owner has handed out.
-- ---------------------------------------------------------------------------
create table if not exists public.public_shares (
  -- 16 random bytes, base64url. The token IS the capability, so it is the
  -- primary key: there is no sequential id to walk.
  token       text primary key,
  owner_id    uuid not null references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('trail', 'card')),
  payload     jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- Revoking is a timestamp, not a delete, so "this link no longer works" and
  -- "this link never existed" are the same answer to a reader (both get
  -- nothing) while the owner can still see it in their list and in their data
  -- export. Account deletion still removes the row outright, via the cascade.
  revoked_at  timestamptz,
  constraint token_format check (token ~ '^[A-Za-z0-9_-]{16,64}$')
);
create index if not exists public_shares_owner_idx
  on public.public_shares (owner_id, created_at desc);

alter table public.public_shares enable row level security;

-- ---------------------------------------------------------------------------
-- Owner-side policies. NOTE what is deliberately absent: there is NO select
-- policy for `anon`.
--
-- The obvious design is a policy like `for select to anon using (revoked_at is
-- null)`. That is wrong, and quietly so: RLS filters ROWS, it does not require a
-- WHERE clause, so an anonymous caller could `select *` and read every share
-- anyone has ever created. The token would stop being a secret the moment one
-- person had one.
--
-- So the table stays unreadable to anon, and public reads go through
-- get_public_share() below, which can only return a row you already named.
-- ---------------------------------------------------------------------------

drop policy if exists "see own public shares" on public.public_shares;
create policy "see own public shares" on public.public_shares
  for select to authenticated
  using (owner_id = auth.uid());

drop policy if exists "create own public share" on public.public_shares;
create policy "create own public share" on public.public_shares
  for insert to authenticated
  with check (owner_id = auth.uid());

-- Revoke (and un-revoke) is an update of the owner's own row.
drop policy if exists "revoke own public share" on public.public_shares;
create policy "revoke own public share" on public.public_shares
  for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "delete own public share" on public.public_shares;
create policy "delete own public share" on public.public_shares
  for delete to authenticated
  using (owner_id = auth.uid());

drop trigger if exists public_shares_set_updated_at on public.public_shares;
create trigger public_shares_set_updated_at
  before insert or update on public.public_shares
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- get_public_share(token) — the ONLY way an anonymous reader reaches this table.
--
-- security definer so it bypasses the (deliberately absent) anon select policy,
-- and it takes the token as an exact-match argument, so it can only ever return
-- a row whose token the caller already knew. No listing, no enumeration, no
-- pattern matching: the capability model the table's design assumes.
--
-- Returns nothing for an unknown OR a revoked token, so the two are
-- indistinguishable from outside. The owner_id is NOT returned: a reader has no
-- business learning the sender's user id, and the sender's name travels in the
-- payload only if the sender put it there.
-- ---------------------------------------------------------------------------
create or replace function public.get_public_share(p_token text)
returns table (kind text, payload jsonb, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select s.kind, s.payload, s.created_at
  from public.public_shares s
  where s.token = p_token
    and s.revoked_at is null;
$$;

-- The function is the public door, so anon needs it. Nothing else is granted.
revoke all on function public.get_public_share(text) from public;
grant execute on function public.get_public_share(text) to anon, authenticated;
