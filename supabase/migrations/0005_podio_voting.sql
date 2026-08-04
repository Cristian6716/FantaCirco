-- ============================================================================
-- Votazione podio — l'admin apre un round, i manager votano 1°/2°/3° tra le
-- squadre. Applicata su Supabase come migrazione `add_podio_voting`.
-- ============================================================================

create table if not exists podio_rounds (
  id serial primary key,
  numero int not null,
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create table if not exists podio_votes (
  round_id int not null references podio_rounds(id) on delete cascade,
  manager_id uuid not null references managers(id) on delete cascade,
  pos1 uuid not null references managers(id),
  pos2 uuid not null references managers(id),
  pos3 uuid not null references managers(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (round_id, manager_id),
  check (pos1 <> pos2 and pos1 <> pos3 and pos2 <> pos3)
);
create index if not exists podio_votes_round_idx on podio_votes(round_id);

alter table podio_rounds enable row level security;
alter table podio_votes enable row level security;

create policy podio_rounds_select on podio_rounds for select to authenticated using (true);
create policy podio_rounds_admin_write on podio_rounds for all to authenticated using (is_admin()) with check (is_admin());

-- I voti sono "ciechi": ognuno vede solo il proprio, l'admin vede tutto.
create policy podio_votes_select on podio_votes for select to authenticated using (
  manager_id = auth.uid() or is_admin()
);
create policy podio_votes_insert_own on podio_votes for insert to authenticated with check (
  manager_id = auth.uid()
  and exists (select 1 from podio_rounds r where r.id = podio_votes.round_id and r.status = 'open')
);
create policy podio_votes_update_own on podio_votes for update to authenticated
  using (manager_id = auth.uid()
    and exists (select 1 from podio_rounds r where r.id = podio_votes.round_id and r.status = 'open'))
  with check (manager_id = auth.uid()
    and exists (select 1 from podio_rounds r where r.id = podio_votes.round_id and r.status = 'open'));

grant select, insert, update on podio_rounds, podio_votes to authenticated;

alter publication supabase_realtime add table podio_rounds;
alter publication supabase_realtime add table podio_votes;
