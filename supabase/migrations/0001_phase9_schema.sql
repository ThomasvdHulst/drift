-- Drift · Phase 9 — Accounts & Cloud Sync
-- Run once: Supabase Studio → SQL Editor → paste → Run. Safe to re-run
-- (idempotent: create-if-not-exists + drop-if-exists on policies/triggers).
--
-- Three tables mirror today's local IndexedDB stores, one row-owner per user,
-- all guarded by Row-Level Security (user_id = auth.uid()). The server owns the
-- updated_at timestamp (via a trigger) so it is the authoritative ordering clock
-- for local-first last-write-wins sync. Soft-delete (`deleted`) lets a delete on
-- one device propagate before rows are ever hard-removed.

-- ---------------------------------------------------------------------------
-- Shared trigger: stamp server time on every insert/update.
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- trails — one row per saved trail (future-shareable in Phase 10).
-- Queryable columns for the bits Phase 10/UI needs; steps[] kept as jsonb.
-- ---------------------------------------------------------------------------
create table if not exists public.trails (
  id            uuid primary key,
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name          text not null default '',
  realm         text,
  liked         boolean not null default false,
  created_at_ms bigint not null default 0,
  steps         jsonb not null default '[]'::jsonb,
  updated_at    timestamptz not null default now(),
  deleted       boolean not null default false
);
create index if not exists trails_user_updated_idx
  on public.trails (user_id, updated_at);

alter table public.trails enable row level security;

drop policy if exists "trails are private to owner" on public.trails;
create policy "trails are private to owner" on public.trails
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists trails_set_updated_at on public.trails;
create trigger trails_set_updated_at
  before insert or update on public.trails
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- reactions — one row per (user, card); per-card last-write-wins.
-- ---------------------------------------------------------------------------
create table if not exists public.reactions (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  card_id    text not null,
  reaction   text not null,
  updated_at timestamptz not null default now(),
  deleted    boolean not null default false,
  primary key (user_id, card_id)
);
create index if not exists reactions_user_updated_idx
  on public.reactions (user_id, updated_at);

alter table public.reactions enable row level security;

drop policy if exists "reactions are private to owner" on public.reactions;
create policy "reactions are private to owner" on public.reactions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists reactions_set_updated_at on public.reactions;
create trigger reactions_set_updated_at
  before insert or update on public.reactions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- user_kv — small per-user blob stores (whole-value last-write-wins).
-- keys: settings · interests · seen · sessions. (topicsCache stays local-only.)
-- ---------------------------------------------------------------------------
create table if not exists public.user_kv (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key        text not null,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);
create index if not exists user_kv_user_updated_idx
  on public.user_kv (user_id, updated_at);

alter table public.user_kv enable row level security;

drop policy if exists "kv is private to owner" on public.user_kv;
create policy "kv is private to owner" on public.user_kv
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists user_kv_set_updated_at on public.user_kv;
create trigger user_kv_set_updated_at
  before insert or update on public.user_kv
  for each row execute function public.set_updated_at();
