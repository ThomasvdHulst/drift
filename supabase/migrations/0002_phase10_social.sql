-- Drift · Phase 10 (M27) — Identity & the friend graph
-- Run once: Supabase Studio → SQL Editor → paste → Run. Safe to re-run.
-- (Sharing/inbox lands in a later migration, 0003.)
--
-- Reuses public.set_updated_at() from 0001. Adds:
--   profiles         — a findable handle + display name per user
--   friend_requests  — mutual friendship (pending → accepted), request-based
--   are_friends()    — helper the shares policy (M28) will use
-- All guarded by Row-Level Security.

-- ---------------------------------------------------------------------------
-- profiles — one row per user; handle is how friends find you.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  handle       text not null unique,
  display_name text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint handle_format check (handle ~ '^[a-z0-9_]{3,30}$')
);
create index if not exists profiles_handle_idx on public.profiles (handle);

alter table public.profiles enable row level security;

-- Any signed-in user can read profiles (needed to search by handle + resolve
-- names). The app restricts search to `handle`, honoring "handle-only" discovery.
drop policy if exists "profiles readable by authenticated" on public.profiles;
create policy "profiles readable by authenticated" on public.profiles
  for select to authenticated using (true);

drop policy if exists "own profile insert" on public.profiles;
create policy "own profile insert" on public.profiles
  for insert to authenticated with check (id = auth.uid());

drop policy if exists "own profile update" on public.profiles;
create policy "own profile update" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before insert or update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- friend_requests — mutual friendship. Friends = an 'accepted' row (either dir).
-- ---------------------------------------------------------------------------
create table if not exists public.friend_requests (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users (id) on delete cascade,
  addressee_id uuid not null references auth.users (id) on delete cascade,
  status       text not null default 'pending'
                 check (status in ('pending', 'accepted', 'declined')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);
create index if not exists friend_requests_addressee_idx
  on public.friend_requests (addressee_id, status);
create index if not exists friend_requests_requester_idx
  on public.friend_requests (requester_id, status);

alter table public.friend_requests enable row level security;

-- See requests you're a party to.
drop policy if exists "see own requests" on public.friend_requests;
create policy "see own requests" on public.friend_requests
  for select to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());

-- Send a request as yourself.
drop policy if exists "send request" on public.friend_requests;
create policy "send request" on public.friend_requests
  for insert to authenticated with check (requester_id = auth.uid());

-- Only the addressee accepts/declines.
drop policy if exists "respond to request" on public.friend_requests;
create policy "respond to request" on public.friend_requests
  for update to authenticated
  using (addressee_id = auth.uid()) with check (addressee_id = auth.uid());

-- Either party can remove (cancel a pending request / unfriend).
drop policy if exists "remove request" on public.friend_requests;
create policy "remove request" on public.friend_requests
  for delete to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());

drop trigger if exists friend_requests_set_updated_at on public.friend_requests;
create trigger friend_requests_set_updated_at
  before insert or update on public.friend_requests
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- are_friends(u1, u2) — true iff an accepted friendship exists (either dir).
-- security definer so it can be used inside RLS policies (e.g. shares in M28).
-- ---------------------------------------------------------------------------
create or replace function public.are_friends(u1 uuid, u2 uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.friend_requests f
    where f.status = 'accepted'
      and ((f.requester_id = u1 and f.addressee_id = u2)
        or (f.requester_id = u2 and f.addressee_id = u1))
  );
$$;
