-- ============================================================================
-- Fanta Dinamica — schema completo (riproduzione delle migrazioni applicate).
-- Ordine: estensioni, enum, tabelle, RLS/policy, funzioni, cron, realtime.
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ---- Enums ----
-- (i ruoli Mantra sono memorizzati come text[] su players.roles, non come enum)
create type player_status as enum ('available','in_auction','assigned');
create type auction_status as enum ('phase1','phase2','paused','ended','cancelled');

-- ---- Tabelle ----
create table managers (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text not null,
  team_name text,
  credits_total int not null default 0 check (credits_total >= 0),
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table players (
  id bigint generated always as identity primary key,
  name text not null,
  real_team text,
  roles text[] not null default '{}',
  status player_status not null default 'available',
  assigned_to uuid references managers(id),
  created_at timestamptz not null default now()
);
create index players_status_idx on players(status);

create table auctions (
  id bigint generated always as identity primary key,
  player_id bigint not null references players(id) on delete cascade,
  created_by uuid not null references managers(id),
  base_price int not null default 1 check (base_price >= 1),
  status auction_status not null default 'phase1',
  started_at timestamptz not null default now(),
  phase1_ends_at timestamptz not null,
  phase2_ends_at timestamptz not null,
  ended_at timestamptz,
  paused_at timestamptz,
  leader_id uuid references managers(id),
  current_bid int not null default 0,
  winner_id uuid references managers(id),
  created_at timestamptz not null default now()
);
create index auctions_status_idx on auctions(status);
create index auctions_leader_idx on auctions(leader_id);
create unique index auctions_one_active_per_player
  on auctions(player_id) where status in ('phase1','phase2','paused');

create table bids (
  id bigint generated always as identity primary key,
  auction_id bigint not null references auctions(id) on delete cascade,
  manager_id uuid not null references managers(id),
  amount int not null check (amount >= 1),
  is_auto boolean not null default false,
  created_at timestamptz not null default now()
);
create index bids_auction_idx on bids(auction_id);
create index bids_manager_idx on bids(manager_id);

create table autobids (
  auction_id bigint not null references auctions(id) on delete cascade,
  manager_id uuid not null references managers(id),
  max_amount int not null check (max_amount >= 1),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (auction_id, manager_id)
);
create index autobids_active_idx on autobids(auction_id) where active;

create table auction_participants (
  auction_id bigint not null references auctions(id) on delete cascade,
  manager_id uuid not null references managers(id),
  joined_in_phase1 boolean not null default false,
  withdrawn boolean not null default false,
  withdrawn_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (auction_id, manager_id)
);
create index participants_manager_idx on auction_participants(manager_id);

create table push_subscriptions (
  id bigint generated always as identity primary key,
  manager_id uuid not null references managers(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index push_subs_manager_idx on push_subscriptions(manager_id);

create table push_outbox (
  id bigint generated always as identity primary key,
  manager_id uuid not null references managers(id) on delete cascade,
  title text not null,
  body text not null,
  url text not null default '/',
  tag text,
  sent boolean not null default false,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  error text
);
create index push_outbox_unsent_idx on push_outbox(created_at) where not sent;

create table app_config (key text primary key, value text not null);

-- ---- RLS ----
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select m.is_admin from managers m where m.id = auth.uid()), false);
$$;

alter table managers enable row level security;
alter table players enable row level security;
alter table auctions enable row level security;
alter table bids enable row level security;
alter table autobids enable row level security;
alter table auction_participants enable row level security;
alter table push_subscriptions enable row level security;
alter table push_outbox enable row level security;
alter table app_config enable row level security;

create policy managers_select on managers for select to authenticated using (true);
create policy managers_admin_write on managers for all to authenticated using (is_admin()) with check (is_admin());
create policy players_select on players for select to authenticated using (true);
create policy players_admin_write on players for all to authenticated using (is_admin()) with check (is_admin());
create policy auctions_select on auctions for select to authenticated using (true);
create policy bids_select on bids for select to authenticated using (true);
create policy autobids_select_own on autobids for select to authenticated using (manager_id = auth.uid() or is_admin());
create policy participants_select on auction_participants for select to authenticated using (true);
create policy push_subs_own on push_subscriptions for all to authenticated using (manager_id = auth.uid()) with check (manager_id = auth.uid());

grant select on managers, players, auctions, bids, autobids, auction_participants to authenticated;
grant insert, update, delete on managers, players to authenticated;
grant select, insert, update, delete on push_subscriptions to authenticated;

-- ---- Crediti ----
create or replace function locked_credits(p_manager uuid) returns int
language sql stable security definer set search_path = public as $$
  select coalesce(sum(current_bid), 0)::int from auctions
  where leader_id = p_manager and status in ('phase1','phase2','paused');
$$;

create or replace function available_credits(p_manager uuid) returns int
language sql stable security definer set search_path = public as $$
  select (m.credits_total - locked_credits(p_manager))::int from managers m where m.id = p_manager;
$$;

create or replace view v_manager_credits with (security_invoker = on) as
select m.id, m.username, m.display_name, m.team_name, m.credits_total, m.is_admin,
       coalesce(l.locked, 0)::int as locked,
       (m.credits_total - coalesce(l.locked, 0))::int as available
from managers m
left join (
  select leader_id as id, sum(current_bid)::int as locked
  from auctions where status in ('phase1','phase2','paused') group by leader_id
) l on l.id = m.id;
grant select on v_manager_credits to authenticated;

-- ---- Notifiche ----
create or replace function _notify(p_manager uuid, p_title text, p_body text,
                                   p_url text default '/', p_tag text default null)
returns void language sql security definer set search_path = public as $$
  insert into push_outbox(manager_id, title, body, url, tag)
  values (p_manager, p_title, p_body, coalesce(p_url, '/'), p_tag);
$$;

-- NOTA: i corpi delle funzioni asta (_end_auction, _advance_auction, _resolve_autobids,
-- _maybe_end_no_challengers, _revert_auction_effects, start_auction, place_bid, set_autobid,
-- withdraw, admin_*, tick) sono nei file numerati 05/06/07/08 di questa cartella.
-- Vedi anche README per il dettaglio della logica.

-- ---- Realtime ----
alter publication supabase_realtime add table auctions;
alter publication supabase_realtime add table bids;
alter publication supabase_realtime add table auction_participants;
