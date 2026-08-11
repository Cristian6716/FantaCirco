-- ============================================================================
-- Sezione Statistiche: storico campionato (stagioni passate), albo d'oro
-- competizioni e bacheca statistiche di mercato.
--
-- Deliberatamente scollegate da `partite`/`giornate`/`punteggi_giornata`
-- (che restano l'unica fonte per la stagione in corso): la stagione passata
-- aveva squadre diverse e un calendario incompleto, quindi vive qui come
-- storico a sé, inserito manualmente dall'admin. Gli scontri diretti (H2H) si
-- calcolano lato client unendo `partite` (corrente) + `storico_partite`
-- (passate) + il bracket Coppa già risolto, senza bisogno di altre tabelle.
-- ============================================================================

create table if not exists storico_partite (
  id serial primary key,
  stagione text not null,
  giornata int not null,
  casa text not null,
  trasferta text not null,
  gol_casa int not null,
  gol_trasferta int not null,
  created_at timestamptz not null default now()
);
create index if not exists storico_partite_stagione_idx on storico_partite(stagione);

create table if not exists albo_oro (
  id serial primary key,
  stagione text not null,
  competizione text not null check (competizione in ('campionato', 'coppa', 'battle_royale')),
  squadra text not null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists albo_oro_squadra_idx on albo_oro(squadra);

create table if not exists statistiche_mercato (
  id serial primary key,
  titolo text not null,
  testo text not null,
  data date,
  created_by uuid references managers(id),
  created_at timestamptz not null default now()
);

alter table storico_partite enable row level security;
alter table albo_oro enable row level security;
alter table statistiche_mercato enable row level security;

create policy storico_partite_select on storico_partite for select to authenticated using (true);
create policy storico_partite_admin_write on storico_partite for all to authenticated using (is_admin()) with check (is_admin());

create policy albo_oro_select on albo_oro for select to authenticated using (true);
create policy albo_oro_admin_write on albo_oro for all to authenticated using (is_admin()) with check (is_admin());

create policy statistiche_mercato_select on statistiche_mercato for select to authenticated using (true);
create policy statistiche_mercato_admin_write on statistiche_mercato for all to authenticated using (is_admin()) with check (is_admin());

alter publication supabase_realtime add table storico_partite;
alter publication supabase_realtime add table albo_oro;
alter publication supabase_realtime add table statistiche_mercato;
