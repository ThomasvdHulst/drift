-- Drift · Phase 33F — a shared link's contents stop changing once it is sent.
-- Run once: Supabase Studio → SQL Editor → paste → Run. Safe to re-run.
-- Depends on 0004 (public_shares).
--
-- WHY THIS EXISTS. 0004 gives the owner an UPDATE policy so a link can be
-- revoked (and un-revoked):
--
--     create policy "revoke own public share" ... for update to authenticated
--       using (owner_id = auth.uid()) with check (owner_id = auth.uid());
--
-- Row-Level Security answers "whose row is this?" and stops there. It never
-- asked WHICH COLUMN, so that policy permits rewriting `payload` as readily as
-- `revoked_at`. Measured against the live project from an ordinary account:
--
--     insert token, payload {"title":"innocuous"}    ok
--     update payload -> {"title":"SWAPPED"}          ACCEPTED
--     anon get_public_share(token) returns           {"title":"SWAPPED"}
--
-- So a link could be sent, forwarded, and then quietly made to say something
-- else, with the recipients holding an address that still works. 0004's own
-- header describes these rows as "a self-contained SNAPSHOT rather than a
-- reference" — true of the trail the snapshot was cut from, but not enforced
-- against the snapshot itself. This closes that.
--
-- ⚠️ DSA CONTEXT, which is why it is worth more than it first looks. 0004
-- records that a forwardable link makes Drift an "online platform" under the
-- DSA, because it is not the "closed group consisting of a finite number of
-- pre-determined persons" that Recital 14 carves out. Bait-and-switch on a
-- forwardable link is exactly the behaviour that frame is concerned with, and
-- "the interface does not offer it" is not an answer when the browser holds a
-- publishable key and can call PostgREST directly.
--
-- WHY COLUMN PRIVILEGES RATHER THAN A TRIGGER. A `BEFORE UPDATE` trigger
-- comparing OLD.payload to NEW.payload would also work, and would be a second
-- mechanism doing a job Postgres already does properly. Column-level GRANTs are
-- checked against the columns named in the UPDATE's SET list, so the refusal
-- happens before any row is touched, it needs no function to maintain, and it
-- reads as what it is: this role may write this column and no other.
--
-- WHAT STILL WORKS. `revokePublicShare` (src/lib/publicshare/client.ts:77) is
-- the only UPDATE the app performs against this table, and it sets exactly
-- `revoked_at`. Un-revoking sets the same column. Creating a link is an INSERT
-- and is untouched, as is deleting one. The `set_updated_at` trigger keeps
-- stamping `updated_at`: a BEFORE trigger's writes to NEW are not checked
-- against the caller's column privileges, only the statement's own SET list is.

do $$
begin
  if not exists (
    select 1 from information_schema.tables
     where table_schema = 'public' and table_name = 'public_shares'
  ) then
    raise exception
      'public_shares is missing — apply 0004_public_shares.sql first';
  end if;
end;
$$;

-- Table-wide UPDATE is withdrawn and handed back one column at a time. Both
-- roles are named explicitly: `anon` should never have held it, and saying so
-- here means this file states the whole truth about who may write.
revoke update on public.public_shares from authenticated, anon;
grant  update (revoked_at) on public.public_shares to authenticated;

-- The row policy from 0004 is unchanged and still does its half of the work:
-- privileges decide WHICH COLUMN, the policy decides WHOSE ROW. Both are needed,
-- and neither is sufficient. (An owner may still delete a link outright, which
-- is a different thing from editing it and remains theirs to do.)
