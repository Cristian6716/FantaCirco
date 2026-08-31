-- ============================================================================
-- Rivalità — duelli fissi tra due squadre per tutta la stagione.
--
-- Ogni manager pronostica una volta sola, a inizio campionato, chi delle due
-- arriverà più in alto in classifica. Il duello poi si segue giornata per
-- giornata (posizione in classifica, calcolata lato client dalle `partite`) e
-- a fine stagione vince chi chiude davanti.
--
-- L'elenco delle rivalità sta a database e non nel codice: l'admin può
-- aggiungerle/rinominarle da pannello senza un deploy.
-- ============================================================================

create table if not exists rivalita (
  id serial primary key,
  team_a text not null,
  team_b text not null,
  soprannome text not null,
  ordine int not null default 0,
  created_at timestamptz not null default now(),
  check (team_a <> team_b)
);

-- Una sola riga: la deadline vale per tutte le rivalità insieme.
create table if not exists rivalita_config (
  id boolean primary key default true check (id),
  chiusura_at timestamptz
);
insert into rivalita_config (id, chiusura_at) values (true, null) on conflict (id) do nothing;

create table if not exists rivalita_votes (
  rivalita_id int not null references rivalita(id) on delete cascade,
  manager_id uuid not null references managers(id) on delete cascade,
  scelta text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (rivalita_id, manager_id)
);
create index if not exists rivalita_votes_rivalita_idx on rivalita_votes(rivalita_id);

-- `scelta` deve essere una delle due squadre del duello: sta su un'altra
-- tabella, quindi serve un trigger e non una check constraint.
create or replace function public.rivalita_scelta_valida()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from rivalita r
    where r.id = new.rivalita_id and new.scelta in (r.team_a, r.team_b)
  ) then
    raise exception 'Scelta % non valida per la rivalità %', new.scelta, new.rivalita_id;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists rivalita_votes_scelta_valida on rivalita_votes;
create trigger rivalita_votes_scelta_valida
  before insert or update on rivalita_votes
  for each row execute function public.rivalita_scelta_valida();

-- Pronostici chiusi: stessa logica della chiusura automatica di giornate e podio.
create or replace function public.rivalita_chiuse()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from rivalita_config c
    where c.chiusura_at is not null and now() >= c.chiusura_at
  )
$$;

grant execute on function public.rivalita_chiuse() to authenticated;

alter table rivalita enable row level security;
alter table rivalita_config enable row level security;
alter table rivalita_votes enable row level security;

create policy rivalita_select on rivalita for select to authenticated using (true);
create policy rivalita_admin_write on rivalita for all to authenticated
  using (is_admin()) with check (is_admin());

create policy rivalita_config_select on rivalita_config for select to authenticated using (true);
create policy rivalita_config_admin_write on rivalita_config for all to authenticated
  using (is_admin()) with check (is_admin());

-- Voti ciechi: ognuno vede solo il proprio, l'admin vede tutto. I totali
-- passano dalla RPC qui sotto.
create policy rivalita_votes_select on rivalita_votes for select to authenticated using (
  manager_id = auth.uid() or is_admin()
);
create policy rivalita_votes_insert_own on rivalita_votes for insert to authenticated
with check (manager_id = auth.uid() and not public.rivalita_chiuse());
create policy rivalita_votes_update_own on rivalita_votes for update to authenticated
using (manager_id = auth.uid() and not public.rivalita_chiuse())
with check (manager_id = auth.uid() and not public.rivalita_chiuse());

grant select on rivalita, rivalita_config to authenticated;
grant select, insert, update on rivalita_votes to authenticated;
grant insert, update, delete on rivalita to authenticated;
grant insert, update on rivalita_config to authenticated;
grant usage, select on sequence rivalita_id_seq to authenticated;

-- Totali per duello. Una rivalità si sblocca quando l'utente l'ha pronosticata,
-- oppure quando i pronostici sono chiusi (o per l'admin, sempre).
create or replace function public.rivalita_riepilogo()
returns table (rivalita_id int, voti_a int, voti_b int)
language sql stable security definer set search_path = public as $$
  select
    r.id,
    (count(*) filter (where v.scelta = r.team_a))::int,
    (count(*) filter (where v.scelta = r.team_b))::int
  from rivalita r
  left join rivalita_votes v on v.rivalita_id = r.id
  where public.rivalita_chiuse()
     or is_admin()
     or exists (
       select 1 from rivalita_votes mv
       where mv.rivalita_id = r.id and mv.manager_id = auth.uid()
     )
  group by r.id;
$$;

revoke all on function public.rivalita_riepilogo() from public, anon;
grant execute on function public.rivalita_riepilogo() to authenticated;

alter publication supabase_realtime add table rivalita;
alter publication supabase_realtime add table rivalita_config;
alter publication supabase_realtime add table rivalita_votes;

-- Rivalità della stagione in corso.
insert into rivalita (team_a, team_b, soprannome, ordine) values
  ('Figli di Putin', 'Fessa Kyoto Fc', 'Derby rumeno', 1),
  ('Fc Padre Tempo', 'Hadjuk Spanato', '104', 2),
  ('Frocinone', 'Fredin FC', 'Puro hate', 3),
  ('Sesko e Sambia', 'Fessa Kyoto Fc', 'Ego smisurato', 4),
  ('Minotoro', 'Fredin FC', 'Caino e Abele', 5),
  ('Napolethanos', 'Energy Team', 'Daje lazio daje', 6),
  ('PASSAMO ALLE COSE FORMALI', 'Fc Padre Tempo', 'Pompini tra omini', 7),
  ('Rubin Kebab', 'One Pisa', 'I pupi', 8)
on conflict do nothing;

-- Pronostici aperti fino a sabato 29 agosto 2026 alle 18:30 (ora italiana).
update rivalita_config
set chiusura_at = timestamptz '2026-08-29 18:30:00 Europe/Rome'
where id = true;
