-- Drift · Phase 33D — write limits on the tables a browser can write to.
-- Run once: Supabase Studio → SQL Editor → paste → Run. Safe to re-run.
-- Depends on 0001 (trails, user_kv), 0003 (shares), 0004 (public_shares).
--
-- WHY THIS EXISTS. Row-Level Security answers "whose row is this?" and stops
-- there. It never asked "how big?" or "how many?", and the browser holds a
-- publishable key by design (CLAUDE.md §4), so every signed-in account had an
-- unmetered write path straight into Postgres. Measured against the live project
-- from an ordinary account, using nothing but the publishable key:
--
--     0.5 MB single row  ACCEPTED   in 4224ms
--       2 MB single row  ACCEPTED   in 2503ms
--       8 MB single row  ACCEPTED   in 2079ms
--     bulk: 500 rows in 3075ms
--
-- The free tier is 500 MB. One account could have filled it in a couple of
-- minutes, which pauses the project — a denial of service on the whole app paid
-- for by the owner. The daily meter (0005) governs READING and has nothing to
-- say about any of this.
--
-- WHAT THE NUMBERS ARE FOR. Measured against the real data at the time of
-- writing, so the ceiling clears every honest row by a wide margin:
--
--     trails.steps    largest real row  41 KB (25 stops)   →  cap 256 KB (~150)
--     user_kv.value   largest real row  12.8 KB (`seen`)   →  cap 256 KB
--     trails rows     62 rows across 16 accounts           →  cap 500 per user
--
-- `seen` has its own FIFO cap of ~500 titles in application code, so it cannot
-- approach this; the cap is here for the case where that code is wrong.
--
-- octet_length(x::text) rather than pg_column_size(x), and the reason is
-- narrower than it first looks. pg_column_size reports the size of a datum as
-- stored, which for a TOASTed column can be the COMPRESSED size — and the
-- abusive payload is exactly the kind that compresses best (megabytes of one
-- repeated character), so the worry was that a filler could slip under the cap
-- by making its junk more repetitive.
--
-- Measured, that worry does not materialise here: inside a CHECK the value has
-- not been toasted yet, so pg_column_size on 8 MB of one repeated character
-- returns 8000027, not something small, and would have refused the row too. Both
-- would work. octet_length is kept anyway because it says what it means without
-- depending on when TOAST happens to run: it is the size of the JSON this row
-- carries, which is the thing being limited. Do not "optimise" it back to
-- pg_column_size on the theory that it is cheaper; the difference is noise on a
-- per-insert basis and the guarantee is weaker.
--
-- HOW IT FAILS FOR A REAL READER, which is the part that matters. The replicator
-- (src/lib/sync/replicator.ts) wraps every push in `catch { markCycleFailed() }`:
-- it never throws into the app, IndexedDB stays the source of truth, and the
-- journal is kept for a later retry. So the worst a rejected write can do is
-- stall cloud sync for one row while reading carries on completely normally,
-- which is the graceful-degradation contract behaving as designed. Nobody is
-- stopped mid-session by a constraint.

-- ---------------------------------------------------------------------------
-- 1. Per-row size ceilings.
--
-- `not valid` then `validate` is deliberate: it takes a weaker lock and cannot
-- fail the migration on an existing row. Nothing in the table today comes close,
-- so the validate is a formality, but it is the safe order on a live database.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'trails_steps_size'
  ) then
    alter table public.trails
      add constraint trails_steps_size
      check (octet_length(steps::text) <= 262144) not valid;
    alter table public.trails validate constraint trails_steps_size;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'user_kv_value_size'
  ) then
    alter table public.user_kv
      add constraint user_kv_value_size
      check (octet_length(value::text) <= 262144) not valid;
    alter table public.user_kv validate constraint user_kv_value_size;
  end if;

  -- A share carries a SNAPSHOT of a card or trail, so it is bounded by the same
  -- reasoning as the trail it was cut from. `shares` is included even though the
  -- friends layer is switched off (NEXT_PUBLIC_SOCIAL): the table is still
  -- writable, so it still deserves a ceiling.
  if not exists (
    select 1 from pg_constraint where conname = 'shares_payload_size'
  ) then
    alter table public.shares
      add constraint shares_payload_size
      check (octet_length(payload::text) <= 262144) not valid;
    alter table public.shares validate constraint shares_payload_size;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'public_shares_payload_size'
  ) then
    alter table public.public_shares
      add constraint public_shares_payload_size
      check (octet_length(payload::text) <= 262144) not valid;
    alter table public.public_shares validate constraint public_shares_payload_size;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Per-user row ceilings.
--
-- A size cap alone does not bound anything: 500 rows arrived in three seconds in
-- the measurement above, and 500 × 256 KB is still 128 MB from one account. The
-- pair is what makes the worst case finite.
--
-- One generic trigger function, parameterised through TG_ARGV, so adding a table
-- later is one CREATE TRIGGER rather than another copy of this logic.
--
-- It counts only on INSERT. An UPDATE cannot increase the row count, and making
-- every update pay for a count would tax the common path (a trail is re-upserted
-- on every stop) for nothing.
-- ---------------------------------------------------------------------------

create or replace function public.enforce_row_cap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_col text := tg_argv[0];
  v_cap       integer := tg_argv[1]::integer;
  v_owner     uuid;
  v_count     bigint;
begin
  execute format('select ($1).%I', v_owner_col) into v_owner using new;
  if v_owner is null then
    return new;
  end if;

  -- Counting to the cap and no further: `limit` lets Postgres stop early on the
  -- (user_id, …) index instead of counting every row the account owns.
  execute format(
    'select count(*) from (select 1 from public.%I where %I = $1 limit $2) t',
    tg_table_name, v_owner_col
  ) into v_count using v_owner, v_cap;

  if v_count >= v_cap then
    raise exception
      'row limit reached for this account (% of %)', v_count, v_cap
      using errcode = 'check_violation',
            hint = 'Delete something before adding more.';
  end if;

  return new;
end;
$$;

drop trigger if exists trails_row_cap on public.trails;
create trigger trails_row_cap
  before insert on public.trails
  for each row execute function public.enforce_row_cap('user_id', '500');

-- A public share link is cheap to make and forwardable by design, so the same
-- reasoning applies; the cap is generous enough that nobody sharing in earnest
-- will meet it.
drop trigger if exists public_shares_row_cap on public.public_shares;
create trigger public_shares_row_cap
  before insert on public.public_shares
  for each row execute function public.enforce_row_cap('owner_id', '500');

-- ---------------------------------------------------------------------------
-- HONEST LIMIT, in the spirit of 0005's and 0006's.
--
-- This bounds one ACCOUNT, not one person. Worst case per account is now roughly
-- 128 MB of trails rather than the whole tier, and email confirmation is on, so
-- filling 500 MB takes several confirmed addresses rather than one loop. That is
-- the right trade for a project read by a few dozen people: it turns a two-minute
-- outage into something a determined person has to work at, without putting a
-- single limit in front of an honest reader.
-- ---------------------------------------------------------------------------
