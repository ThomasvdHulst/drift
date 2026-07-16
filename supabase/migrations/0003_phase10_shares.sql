-- Drift · Phase 10 (M28) — Sharing & the inbox
-- Run once: Supabase Studio → SQL Editor → paste → Run. Safe to re-run.
-- Depends on 0002 (are_friends()) + 0001 (set_updated_at()).
--
-- shares — a friend-to-friend inbox item. The payload is a self-contained
-- SNAPSHOT (a trail with its steps, or a card), so the recipient never needs
-- read access to the sender's own RLS-protected rows, and later edits by the
-- sender don't leak.

create table if not exists public.shares (
  id           uuid primary key default gen_random_uuid(),
  sender_id    uuid not null references auth.users (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  kind         text not null check (kind in ('trail', 'card')),
  payload      jsonb not null,
  note         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  read         boolean not null default false,
  check (sender_id <> recipient_id)
);
create index if not exists shares_recipient_idx
  on public.shares (recipient_id, created_at desc);

alter table public.shares enable row level security;

-- See shares you sent or received.
drop policy if exists "see own shares" on public.shares;
create policy "see own shares" on public.shares
  for select to authenticated
  using (recipient_id = auth.uid() or sender_id = auth.uid());

-- Send only as yourself, and only to a FRIEND (enforced in the DB, not just UI).
drop policy if exists "send to a friend" on public.shares;
create policy "send to a friend" on public.shares
  for insert to authenticated
  with check (sender_id = auth.uid() and public.are_friends(auth.uid(), recipient_id));

-- The recipient can mark read (update).
drop policy if exists "recipient updates share" on public.shares;
create policy "recipient updates share" on public.shares
  for update to authenticated
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

-- Either party can remove it.
drop policy if exists "remove share" on public.shares;
create policy "remove share" on public.shares
  for delete to authenticated
  using (recipient_id = auth.uid() or sender_id = auth.uid());

drop trigger if exists shares_set_updated_at on public.shares;
create trigger shares_set_updated_at
  before insert or update on public.shares
  for each row execute function public.set_updated_at();
