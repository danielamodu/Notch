-- =============================================================
-- Notch — Social conviction markets on Nimiq Pay
-- Complete data-layer setup. Run once in the Supabase SQL editor
-- (or as a migration). Idempotent: safe to re-run.
-- =============================================================

-- gen_random_uuid()
create extension if not exists "pgcrypto";

-- -------------------------------------------------------------
-- TABLES
-- -------------------------------------------------------------

create table if not exists public.markets (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  creator_address text not null,
  creation_tx_hash text,
  question text not null,
  side_a_label text not null,
  side_b_label text not null,
  category text not null check (category in ('crypto', 'sports', 'culture', 'politics', 'other')),
  type text not null check (type in ('opinion', 'prediction')),
  duration_ends_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'resolving', 'resolved')),
  winning_side text check (winning_side in ('a', 'b')),
  total_nim_a numeric not null default 0,
  total_nim_b numeric not null default 0,
  total_bettors integer not null default 0,
  -- Set by resolveMarket() helper; not in the original spec table
  -- list but required by it (null until resolved).
  resolved_at timestamptz,
  resolution_tx_hashes text[],
  share_url text
);

create table if not exists public.bets (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  market_id uuid not null references public.markets (id) on delete cascade,
  bettor_address text not null,
  side text not null check (side in ('a', 'b')),
  amount_nim numeric not null check (amount_nim > 0),
  tx_hash text not null,
  tx_memo text,
  payout_amount numeric,
  payout_tx_hash text,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'won', 'lost', 'paid'))
);

create table if not exists public.profiles (
  address text primary key,
  created_at timestamptz not null default now(),
  device_id text,
  total_markets_created integer not null default 0,
  total_bets_placed integer not null default 0,
  total_nim_won numeric not null default 0,
  total_nim_lost numeric not null default 0,
  win_count integer not null default 0,
  loss_count integer not null default 0,
  current_streak integer not null default 0,
  best_streak integer not null default 0
);

create table if not exists public.payouts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  market_id uuid not null references public.markets (id) on delete cascade,
  bet_id uuid not null references public.bets (id) on delete cascade,
  winner_address text not null,
  amount_nim numeric not null check (amount_nim > 0),
  tx_hash text,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'confirmed', 'failed'))
);

-- -------------------------------------------------------------
-- INDEXES
-- -------------------------------------------------------------

create index if not exists bets_market_id_idx on public.bets (market_id);
create index if not exists bets_bettor_address_idx on public.bets (bettor_address);
create index if not exists bets_status_idx on public.bets (status);
create index if not exists markets_status_idx on public.markets (status);
create index if not exists markets_duration_ends_at_idx on public.markets (duration_ends_at);
create index if not exists markets_creator_address_idx on public.markets (creator_address);
create index if not exists payouts_market_id_idx on public.payouts (market_id);
create index if not exists payouts_winner_address_idx on public.payouts (winner_address);

-- -------------------------------------------------------------
-- ROW LEVEL SECURITY
--
-- NOTE on identity: this app identifies users by Nimiq wallet
-- address, not Supabase Auth, so anon + authenticated roles share
-- the same permissive insert/update policies for now. Creator-only
-- updates are enforced in the app layer (and should move to a
-- backend check / Supabase Auth once wallet auth is wired up).
-- The service_role key bypasses RLS entirely (used for payouts).
-- -------------------------------------------------------------

alter table public.markets enable row level security;
alter table public.bets enable row level security;
alter table public.profiles enable row level security;
alter table public.payouts enable row level security;

-- Markets
drop policy if exists "markets_select_all" on public.markets;
create policy "markets_select_all" on public.markets
  for select to anon, authenticated
  using (status in ('active', 'resolving', 'resolved'));

drop policy if exists "markets_insert_all" on public.markets;
create policy "markets_insert_all" on public.markets
  for insert to anon, authenticated
  with check (true);

-- Creator-only update is enforced app-side (see note above):
-- no auth.jwt <-> creator_address binding exists yet.
drop policy if exists "markets_update_all" on public.markets;
create policy "markets_update_all" on public.markets
  for update to anon, authenticated
  using (true)
  with check (true);

-- No delete policy: market deletes go through the backend only.

-- Bets: fully transparent, append-only for clients.
drop policy if exists "bets_select_all" on public.bets;
create policy "bets_select_all" on public.bets
  for select to anon, authenticated
  using (true);

drop policy if exists "bets_insert_all" on public.bets;
create policy "bets_insert_all" on public.bets
  for insert to anon, authenticated
  with check (true);

-- No update/delete policies: bets are immutable for clients.

-- Profiles
drop policy if exists "profiles_select_all" on public.profiles;
create policy "profiles_select_all" on public.profiles
  for select to anon, authenticated
  using (true);

drop policy if exists "profiles_insert_all" on public.profiles;
create policy "profiles_insert_all" on public.profiles
  for insert to anon, authenticated
  with check (true);

-- Own-profile update enforced app-side via address match (see note).
drop policy if exists "profiles_update_all" on public.profiles;
create policy "profiles_update_all" on public.profiles
  for update to anon, authenticated
  using (true)
  with check (true);

-- Payouts: readable by all, writable by service_role only
-- (no insert/update policies for anon/authenticated = denied).
drop policy if exists "payouts_select_all" on public.payouts;
create policy "payouts_select_all" on public.payouts
  for select to anon, authenticated
  using (true);

-- -------------------------------------------------------------
-- RPC: atomic odds update (avoids race conditions on hot markets)
-- -------------------------------------------------------------

create or replace function public.update_market_odds(
  p_market_id uuid,
  p_side text,
  p_amount numeric
)
returns void as $$
begin
  if p_side not in ('a', 'b') then
    raise exception 'update_market_odds: p_side must be ''a'' or ''b''';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'update_market_odds: p_amount must be > 0';
  end if;

  if p_side = 'a' then
    update public.markets
    set total_nim_a = total_nim_a + p_amount,
        total_bettors = total_bettors + 1
    where id = p_market_id;
  else
    update public.markets
    set total_nim_b = total_nim_b + p_amount,
        total_bettors = total_bettors + 1
    where id = p_market_id;
  end if;
end;
$$ language plpgsql
set search_path = public;

-- -------------------------------------------------------------
-- REALTIME (idempotent adds to the supabase_realtime publication)
-- -------------------------------------------------------------

alter table public.markets replica identity full;
alter table public.bets replica identity full;
alter table public.payouts replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'markets'
  ) then
    alter publication supabase_realtime add table public.markets;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'bets'
  ) then
    alter publication supabase_realtime add table public.bets;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'payouts'
  ) then
    alter publication supabase_realtime add table public.payouts;
  end if;
end $$;

-- -------------------------------------------------------------
-- SEED DATA (5 markets so the feed is not empty)
-- -------------------------------------------------------------

insert into public.markets
  (question, side_a_label, side_b_label, category, type,
   duration_ends_at, creator_address,
   total_nim_a, total_nim_b, total_bettors, status)
values
  ('Will Bitcoin hit $150k before end of 2026?',
   'Yes', 'No', 'crypto', 'prediction',
   now() + interval '7 days',
   'NQ07 0000 0000 0000 0000 0000 0000 0000 0000',
   45.5, 32.0, 12, 'active'),
  ('Is Ethereum still the king of DeFi?',
   'Yes', 'Base took over', 'crypto', 'opinion',
   now() + interval '24 hours',
   'NQ07 0000 0000 0000 0000 0000 0000 0000 0000',
   28.0, 41.5, 8, 'active'),
  ('Messi is the greatest footballer of all time',
   'Agree', 'Disagree', 'sports', 'opinion',
   now() + interval '3 days',
   'NQ07 0000 0000 0000 0000 0000 0000 0000 0000',
   67.0, 23.5, 19, 'active'),
  ('AI will replace most developers by 2028',
   'It will', 'Never happening', 'culture', 'opinion',
   now() + interval '6 hours',
   'NQ07 0000 0000 0000 0000 0000 0000 0000 0000',
   15.0, 52.0, 14, 'active'),
  ('Will Nimiq hit top 100 CMC before 2027?',
   'Yes', 'No', 'crypto', 'prediction',
   now() + interval '5 days',
   'NQ07 0000 0000 0000 0000 0000 0000 0000 0000',
   88.5, 34.0, 27, 'active')
on conflict do nothing;
