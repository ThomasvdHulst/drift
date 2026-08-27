-- Drift · Phase 33E — the row cap 0007 left off `user_kv`.
-- Run once: Supabase Studio → SQL Editor → paste → Run. Safe to re-run.
-- Depends on 0001 (user_kv) and 0007 (enforce_row_cap).
--
-- WHY THIS EXISTS. 0007 closed an unmetered write path into Postgres by pairing
-- two limits on every table a browser can write to: a per-ROW size ceiling and a
-- per-USER row count. Its own header says why both are needed:
--
--     "A size cap alone does not bound anything: 500 rows arrived in three
--      seconds in the measurement above, and 500 × 256 KB is still 128 MB from
--      one account. The pair is what makes the worst case finite."
--
-- `trails` and `public_shares` got the pair. **`user_kv` got only the size cap.**
-- Its primary key is (user_id, key) and `key` is free-form text with no
-- allowlist, so a signed-in browser could invent as many keys as it liked and
-- the 256 KB ceiling applied to each one separately. Measured against the live
-- project from an ordinary account holding nothing but the publishable key:
--
--     300 rows under invented keys   ACCEPTED in  236ms
--     20 rows × ~250 KB (~5 MB)      ACCEPTED in 2370ms
--
--     500 MB free tier ÷ 250 KB  ≈  2,000 rows  ≈  ~4 minutes of writing
--
-- Filling the tier pauses the project, which is a denial of service on the whole
-- app paid for by the owner — precisely the outcome 0007 was written to prevent,
-- reached through the one writable table that never got the trigger.
--
-- WHY 20, AND WHY A CAP RATHER THAN AN ALLOWLIST. The replicator writes exactly
-- four blobs (`src/lib/sync/replicator.ts`): interests, settings, seen, sessions.
-- A CHECK constraint listing those four would be tighter still — it would bound
-- the table at four rows per user structurally — but it turns "add a fifth local
-- store" into a schema migration, and a sync layer that fails closed on an
-- unrecognised key fails in a way nobody would connect to this file. 20 leaves
-- five times the headroom the app has ever needed while cutting the worst case
-- from unbounded to ~5 MB per account, and it reuses the generic trigger 0007
-- already installed rather than introducing a second mechanism.
--
-- HOW IT FAILS FOR A REAL READER, which is the part that matters. Same as 0007:
-- the replicator wraps every push in `catch { markCycleFailed() }`, so a rejected
-- write stalls cloud sync for one blob while IndexedDB stays the source of truth
-- and reading carries on untouched. Nobody is stopped mid-session. A real reader
-- cannot reach 20 in the first place.

do $$
begin
  -- `enforce_row_cap` is parameterised through TG_ARGV precisely so a new table
  -- is one CREATE TRIGGER rather than another copy of the counting logic. Guard
  -- on its existence so this file gives a clear error if 0007 was never applied,
  -- rather than a confusing one from the CREATE TRIGGER below.
  if not exists (
    select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'enforce_row_cap'
  ) then
    raise exception
      'enforce_row_cap() is missing — apply 0007_write_limits.sql first';
  end if;
end;
$$;

drop trigger if exists user_kv_row_cap on public.user_kv;
create trigger user_kv_row_cap
  before insert on public.user_kv
  for each row execute function public.enforce_row_cap('user_id', '20');

-- ---------------------------------------------------------------------------
-- HONEST LIMIT, in the spirit of 0005's, 0006's and 0007's.
--
-- This bounds one ACCOUNT, not one person, exactly as 0007's caps do. The worst
-- case per account across every writable table is now roughly 128 MB of trails
-- plus ~5 MB of blobs rather than the whole tier, and email confirmation is on,
-- so approaching 500 MB takes a number of confirmed addresses rather than one
-- loop in a console. That is the right trade for a project read by a few dozen
-- people: it turns a four-minute outage into something a determined person has
-- to work at, without putting a single limit in front of an honest reader.
-- ---------------------------------------------------------------------------
