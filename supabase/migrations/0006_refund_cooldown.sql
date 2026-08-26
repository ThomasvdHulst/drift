-- Drift · Phase 32B — the refund cooldown.
-- Run once: Supabase Studio → SQL Editor → paste → Run. Safe to re-run.
-- Depends on 0005 (entitlements).
--
-- WHY THIS EXISTS. A refund gives the buyer their €7 back, but Stripe keeps the
-- fee it charged on the original payment: the seller is out roughly €0,30 to
-- €0,60 every time somebody buys and changes their mind. That is a fine cost for
-- an honest reader exercising the fourteen day right. It is not fine as a loop:
-- buy, refund, buy, refund, and the fee is charged again on every turn, with the
-- money always ending up back where it started and only the seller paying.
--
-- So a refund now starts a waiting period before that account can buy again.
-- Two columns, and NEITHER of them is `revoked_at`, which already exists:
--
--   `revoked_at`  = "the unlock is not active". Cleared by the next purchase,
--                   because that is what makes buying again work at all.
--   `refunded_at` = "money was given back, at this moment". NEVER cleared, so
--                   the record survives a later purchase and a second refund
--                   simply overwrites it with the newer moment.
--
-- Keeping them apart is what lets the cooldown outlive the thing that caused it.
-- A revocation that is not a refund (a hand-fixed grant, say) sets only the
-- first, and correctly triggers no cooldown.
--
-- `refund_count` is not used by the rule. It exists so the owner can SEE a
-- repeat: one refund is a reader changing their mind, five is a pattern, and
-- without a counter the only trace of the earlier ones is the Stripe dashboard.
-- It is also the hook if the wait ever needs to grow with the count.
--
-- ⚠️ HONEST LIMIT, in the same spirit as 0005's. This is keyed on `user_id`, so
-- it cascades away with the account. Somebody who deletes their account and signs
-- up again gets a clean slate. Closing that would mean keeping an identifier
-- (an email hash) after an erasure request, which is a real cost to every honest
-- reader to inconvenience one dishonest one, on a project with a few dozen of
-- them. The trade is written down rather than pretended away. See
-- docs/supporter.md §7.
-- ---------------------------------------------------------------------------

alter table public.entitlements
  add column if not exists refunded_at  timestamptz,
  add column if not exists refund_count integer not null default 0;

-- Backfill: before this migration, the ONLY thing that set `revoked_at` on a
-- purchased entitlement was a refund, so an existing revoked purchase is a
-- refund we simply had no column for. Recording it is the truthful value, and
-- the rule then treats it exactly as it would have at the time (a refund older
-- than the waiting period is already clear). Guarded on `refunded_at is null`,
-- so re-running this file cannot move a timestamp that is already set.
update public.entitlements
   set refunded_at  = revoked_at,
       refund_count = 1
 where source = 'purchase'
   and revoked_at is not null
   and refunded_at is null;

-- Note there is deliberately NO new policy and NO new function. Reading these
-- two columns is covered by 0005's `see own entitlement` (the policy is on the
-- row, not on a column list), which is what lets the buy button show the reader
-- their own remaining wait. Writing them is done by the two server routes that
-- issue refunds, holding the service key, exactly as revoking already was: the
-- browser has no write path into this table at all, and that stays true.
