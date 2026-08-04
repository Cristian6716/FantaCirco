-- ============================================================================
-- Pronostici + Tornei (Battle Royale e bracket) — integrazione in Fanta Dinamica
-- Applicata su Supabase come migrazione `add_pronostici_tornei_schema`.
-- ============================================================================

-- Calendario: una riga per giornata (G23..G38).
create table if not exists giornate (
  numero int primary key,
  pronostici_chiusi boolean not null default false,
  created_at timestamptz not null default now()
);

-- Partite del calendario "ufficiale" (8 per giornata). I nomi squadra sono i
-- team_name dei manager; casa_manager/trasferta_manager collegano al profilo.
create table if not exists partite (
  id text primary key,
  giornata int not null references giornate(numero) on delete cascade,
  ordine int not null default 0,
  casa text not null,
  trasferta text not null,
  casa_manager uuid references managers(id),
  trasferta_manager uuid references managers(id),
  data_ora timestamptz,
  gol_casa int,
  gol_trasferta int
);
create index if not exists partite_giornata_idx on partite(giornata);

-- Pronostici degli utenti (3 pt per 1X2, 1 pt per Over/Under o Multigol da G24).
create table if not exists pronostici (
  manager_id uuid not null references managers(id) on delete cascade,
  partita_id text not null references partite(id) on delete cascade,
  giornata int not null,
  pronostico_1x2 text not null check (pronostico_1x2 in ('1','X','2')),
  pronostico_ou text not null check (pronostico_ou in ('Over','Under','Si','No')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (manager_id, partita_id)
);
create index if not exists pronostici_giornata_idx on pronostici(giornata);

-- Punteggio fanta di ogni squadra per giornata: alimenta Battle Royale e bracket.
create table if not exists punteggi_giornata (
  giornata int not null references giornate(numero) on delete cascade,
  manager_id uuid not null references managers(id) on delete cascade,
  punteggio numeric(6,2) not null,
  primary key (giornata, manager_id)
);

-- Spareggi del bracket decisi a mano (quando punteggio fanta identico).
create table if not exists torneo_overrides (
  match_id text primary key,
  winner text not null check (winner in ('A','B')),
  updated_at timestamptz not null default now()
);

-- ---- RLS ----
alter table giornate enable row level security;
alter table partite enable row level security;
alter table pronostici enable row level security;
alter table punteggi_giornata enable row level security;
alter table torneo_overrides enable row level security;

create policy giornate_select on giornate for select to authenticated using (true);
create policy giornate_admin_write on giornate for all to authenticated using (is_admin()) with check (is_admin());
create policy partite_select on partite for select to authenticated using (true);
create policy partite_admin_write on partite for all to authenticated using (is_admin()) with check (is_admin());
create policy punteggi_select on punteggi_giornata for select to authenticated using (true);
create policy punteggi_admin_write on punteggi_giornata for all to authenticated using (is_admin()) with check (is_admin());
create policy overrides_select on torneo_overrides for select to authenticated using (true);
create policy overrides_admin_write on torneo_overrides for all to authenticated using (is_admin()) with check (is_admin());

-- Pronostici: ognuno vede solo i propri finché la giornata è aperta; dopo la
-- chiusura (o se admin) diventano visibili a tutti per classifica/storico.
create policy pronostici_select on pronostici for select to authenticated using (
  manager_id = auth.uid()
  or is_admin()
  or exists (select 1 from giornate g where g.numero = pronostici.giornata and g.pronostici_chiusi)
);
create policy pronostici_insert_own on pronostici for insert to authenticated with check (
  manager_id = auth.uid()
  and not exists (select 1 from giornate g where g.numero = pronostici.giornata and g.pronostici_chiusi)
);
create policy pronostici_update_own on pronostici for update to authenticated
  using (manager_id = auth.uid()
    and not exists (select 1 from giornate g where g.numero = pronostici.giornata and g.pronostici_chiusi))
  with check (manager_id = auth.uid()
    and not exists (select 1 from giornate g where g.numero = pronostici.giornata and g.pronostici_chiusi));
create policy pronostici_delete_own on pronostici for delete to authenticated using (
  manager_id = auth.uid()
  and not exists (select 1 from giornate g where g.numero = pronostici.giornata and g.pronostici_chiusi)
);

grant select, insert, update, delete on giornate, partite, punteggi_giornata, torneo_overrides to authenticated;
grant select, insert, update, delete on pronostici to authenticated;

-- ---- Realtime ----
alter publication supabase_realtime add table partite;
alter publication supabase_realtime add table pronostici;
alter publication supabase_realtime add table punteggi_giornata;
alter publication supabase_realtime add table torneo_overrides;
alter publication supabase_realtime add table giornate;

-- Il seed del calendario (giornate 23-38 + 128 partite) è nel file
-- 0004_seed_calendario.sql.
