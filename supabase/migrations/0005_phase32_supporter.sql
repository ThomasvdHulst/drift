-- Drift · Phase 32 — The supporter unlock (daily meter + entitlement)
-- Run once: Supabase Studio → SQL Editor → paste → Run. Safe to re-run.
-- Depends on 0001 (set_updated_at()).
--
-- WHAT THIS IS. Free reading gets a daily allowance of "stops" (cards entering a
-- trail); a one-time €7 purchase lifts it. Two tables, and the interesting part
-- is what they DELIBERATELY do not have.
--
-- ⚠️ NEITHER TABLE HAS A WRITE POLICY, AND THAT IS THE WHOLE SECURITY MODEL.
-- Drift talks to Supabase directly from the browser (a sanctioned exception, see
-- CLAUDE.md §4): the publishable key is public and RLS is the enforcement. So the
-- obvious design — a table plus "you may update your own row" — hands every
-- reader a console one-liner that sets their counter back to zero, and hands them
-- an entitlement they did not buy. Both tables therefore grant SELECT on your own
-- rows and nothing else. Every write goes through a `security definer` function
-- below, which runs as the owner, bypasses RLS, and can only do the one specific
-- thing it was written to do: add exactly one.
--
-- The purchase path writes with the SERVER-ONLY secret key from the Stripe
-- webhook route, never from a browser.
--
-- HONEST LIMIT. This is a soft meter. It stops the trivial bypass (editing your
-- own row) but not a determined reader who simply never calls `record_stop`. That
-- is the correct trade for a personal project read by a few dozen people, and it
-- is written down rather than pretended away.

-- ---------------------------------------------------------------------------
-- entitlements — one row per user who holds the supporter unlock.
--
-- `source` records HOW it was acquired, because the three cases behave
-- differently when something goes wrong: 'purchase' has Stripe references to
-- refund against, 'beta' was a gift to the people who tested Drift before it
-- cost anything, and 'manual' is the owner fixing a payment that went strange.
--
-- Revoking is a timestamp rather than a delete, so a refunded purchase leaves
-- the history intact (and the Stripe ids with it) instead of vanishing.
--
-- NOTE ON DELETION. This cascades from auth.users, so deleting an account also
-- deletes the proof of purchase — deliberate, and /terms says so. The FISCAL
-- record lives in Stripe, which is where the Dutch seven-year bookkeeping
-- obligation is actually met, so erasure here destroys nothing that has to be
-- kept.
-- ---------------------------------------------------------------------------
create table if not exists public.entitlements (
  user_id               uuid primary key references auth.users (id) on delete cascade,
  kind                  text not null default 'supporter'
                          check (kind in ('supporter')),
  source                text not null
                          check (source in ('purchase', 'beta', 'manual')),
  granted_at            timestamptz not null default now(),
  revoked_at            timestamptz,
  -- Stripe references. Null for 'beta' and 'manual' grants.
  stripe_customer_id    text,
  -- Unique so a webhook delivered twice (Stripe retries, and it is at-least-once)
  -- cannot grant twice. This is the idempotency key.
  stripe_session_id     text unique,
  stripe_payment_intent text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table public.entitlements enable row level security;

-- Read your own. That is the entire policy set: see the header.
drop policy if exists "see own entitlement" on public.entitlements;
create policy "see own entitlement" on public.entitlements
  for select to authenticated
  using (user_id = auth.uid());

drop trigger if exists entitlements_set_updated_at on public.entitlements;
create trigger entitlements_set_updated_at
  before insert or update on public.entitlements
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- usage_daily — how many stops you made on a given day.
--
-- WHY THE DAY IS A DATE AND NOT A TIMESTAMP, AND WHOSE MIDNIGHT IT IS. The day
-- is computed server-side in Europe/Amsterdam. UTC would roll over at 01:00 or
-- 02:00 local time, which is the middle of an evening's reading; a client-supplied
-- date would be spoofable by moving the device clock. The reader is in the
-- Netherlands, so the reader's midnight is the one that means anything.
--
-- RETENTION. A per-day record of how much someone read is behavioural data and
-- there is no reason to keep a history of it. `record_stop` prunes anything older
-- than 30 days for that user on their first stop of a new day, so the table stays
-- a rolling window rather than a reading diary (GDPR Article 5(1)(c)).
-- ---------------------------------------------------------------------------
create table if not exists public.usage_daily (
  user_id uuid not null references auth.users (id) on delete cascade,
  day     date not null,
  stops   integer not null default 0,
  primary key (user_id, day)
);

alter table public.usage_daily enable row level security;

drop policy if exists "see own usage" on public.usage_daily;
create policy "see own usage" on public.usage_daily
  for select to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- record_stop() — the ONLY write path into usage_daily.
--
-- Adds exactly one to today's count and returns the new total. It takes no
-- arguments on purpose: there is no amount to inflate and no date to choose, so
-- the worst a caller can do is call it (which is what reading a card does anyway)
-- or not call it.
--
-- Returns zero rows when there is no authenticated user, which the client treats
-- as "could not count" and carries on reading (CLAUDE.md §4: the meter fails
-- OPEN — an unreachable backend must never stop someone reading).
-- ---------------------------------------------------------------------------
create or replace function public.record_stop()
returns table (stops integer, day date)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_day   date := (now() at time zone 'Europe/Amsterdam')::date;
  v_stops integer;
begin
  if v_uid is null then
    return;
  end if;

  -- ⚠️ The conflict target is named by CONSTRAINT, not by column list.
  -- `on conflict (user_id, day)` looks more natural and fails at runtime with
  -- `column reference "day" is ambiguous`: PL/pgSQL sees `day` as this function's
  -- OUT parameter before it sees the column. It is a silent failure in practice,
  -- because the meter fails open, so the app looks perfectly healthy while
  -- nothing is ever counted. Found by scripts/verify-billing.mjs.
  insert into public.usage_daily as u (user_id, day, stops)
  values (v_uid, v_day, 1)
  on conflict on constraint usage_daily_pkey do update set stops = u.stops + 1
  returning u.stops into v_stops;

  -- First stop of a new day: drop this user's old rows. Once a day per reader,
  -- on a primary-key range, so it costs nothing worth measuring.
  if v_stops = 1 then
    delete from public.usage_daily d
    where d.user_id = v_uid and d.day < v_day - 30;
  end if;

  stops := v_stops;
  day := v_day;
  return next;
end;
$$;

revoke all on function public.record_stop() from public;
grant execute on function public.record_stop() to authenticated;

-- ---------------------------------------------------------------------------
-- supporter_status() — today's count and whether the meter applies, in one call.
--
-- Exists so the feed can answer "where am I?" on mount without two round trips,
-- and so the two facts can never be read from different moments.
-- ---------------------------------------------------------------------------
create or replace function public.supporter_status()
returns table (stops integer, day date, supporter boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_day date := (now() at time zone 'Europe/Amsterdam')::date;
begin
  if v_uid is null then
    return;
  end if;

  stops := coalesce(
    (select u.stops from public.usage_daily u
      where u.user_id = v_uid and u.day = v_day),
    0);
  day := v_day;
  supporter := exists (
    select 1 from public.entitlements e
    where e.user_id = v_uid and e.revoked_at is null
  );
  return next;
end;
$$;

revoke all on function public.supporter_status() from public;
grant execute on function public.supporter_status() to authenticated;

-- ---------------------------------------------------------------------------
-- Grandfathering: everyone who was already here reads without a meter, forever.
--
-- They tested Drift back when it cost nothing and were never going to be the
-- revenue. Doing it as a one-off sweep INSIDE the migration makes it a fact about
-- the moment the migration ran, rather than a date comparison someone has to keep
-- maintaining in application code.
--
-- ⚠️ THE GUARD IS LOAD-BEARING. Without it, re-running this file (which every
-- other migration here invites you to do) would sweep again and hand the unlock
-- to everyone who has signed up since — silently turning off the paywall. So the
-- sweep runs only while no 'beta' grant exists, i.e. exactly once.
--
-- Consequence to know about: run this at the point you actually go live. If you
-- run it during testing and then again later, the second run does nothing, and
-- the fix is the 'manual' source (see docs/supporter.md).
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from public.entitlements where source = 'beta') then
    insert into public.entitlements (user_id, kind, source)
    select u.id, 'supporter', 'beta' from auth.users u
    on conflict (user_id) do nothing;
  end if;
end;
$$;
