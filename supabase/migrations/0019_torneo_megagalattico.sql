-- ============================================================================
-- Torneo Megagalattico — prima fase (sistema svizzero + gironi A/B).
-- La fase finale (Coppa, torneoData.ts) resta invariata: qui costruiamo solo
-- la prima fase che la precede. Stesso pattern RLS/grant/realtime di
-- 0003_pronostici_tornei.sql. I risultati si derivano da `punteggi_giornata`
-- esistente, esattamente come Battle Royale e Coppa: qui salviamo solo gli
-- accoppiamenti (che dipendono da un sorteggio, quindi non sono una pura
-- funzione dei punteggi) e la mappatura step→giornata reale.
-- ============================================================================

-- Mappa "step della prima fase" → giornata reale. Popolata via via dall'admin
-- (le giornate reali si decidono strada facendo, alcune vengono saltate).
create table if not exists mega_turni (
  step_type text not null check (step_type in ('svizzero', 'gironi')),
  step_numero smallint not null,
  giornata_reale int references giornate(numero),
  primary key (step_type, step_numero)
);

-- Accoppiamenti generati dal sorteggio di ogni turno svizzero (1..5).
create table if not exists mega_accoppiamenti (
  id bigint generated always as identity primary key,
  turno smallint not null,
  manager_a uuid not null references managers(id),
  manager_b uuid not null references managers(id),
  created_at timestamptz not null default now()
);
create index if not exists mega_accoppiamenti_turno_idx on mega_accoppiamenti(turno);

-- Calendario dei due gironi all'italiana da 8 (generato via round robin, un
-- click, nessun sorteggio: girone e round determinano quale giornata reale
-- usare tramite mega_turni step_type='gironi').
create table if not exists mega_gironi_partite (
  id bigint generated always as identity primary key,
  girone char(1) not null check (girone in ('A', 'B')),
  round smallint not null,
  manager_a uuid not null references managers(id),
  manager_b uuid not null references managers(id)
);
create index if not exists mega_gironi_partite_girone_round_idx on mega_gironi_partite(girone, round);

-- Esito del sorteggio finale verso il tabellone Coppa (upper/mid/lower):
-- registrato per riferimento admin, non ricablato automaticamente in Coppa.
create table if not exists mega_coppa_seeding (
  id bigint generated always as identity primary key,
  bracket text not null check (bracket in ('upper', 'mid', 'lower')),
  manager_a uuid not null references managers(id),
  manager_b uuid not null references managers(id),
  created_at timestamptz not null default now()
);

-- ---- RLS ----
alter table mega_turni enable row level security;
alter table mega_accoppiamenti enable row level security;
alter table mega_gironi_partite enable row level security;
alter table mega_coppa_seeding enable row level security;

create policy mega_turni_select on mega_turni for select to authenticated using (true);
create policy mega_turni_admin_write on mega_turni for all to authenticated using (is_admin()) with check (is_admin());
create policy mega_accoppiamenti_select on mega_accoppiamenti for select to authenticated using (true);
create policy mega_accoppiamenti_admin_write on mega_accoppiamenti for all to authenticated using (is_admin()) with check (is_admin());
create policy mega_gironi_partite_select on mega_gironi_partite for select to authenticated using (true);
create policy mega_gironi_partite_admin_write on mega_gironi_partite for all to authenticated using (is_admin()) with check (is_admin());
create policy mega_coppa_seeding_select on mega_coppa_seeding for select to authenticated using (true);
create policy mega_coppa_seeding_admin_write on mega_coppa_seeding for all to authenticated using (is_admin()) with check (is_admin());

grant select, insert, update, delete on mega_turni, mega_accoppiamenti, mega_gironi_partite, mega_coppa_seeding to authenticated;

-- ---- Realtime ----
alter publication supabase_realtime add table mega_turni;
alter publication supabase_realtime add table mega_accoppiamenti;
alter publication supabase_realtime add table mega_gironi_partite;
alter publication supabase_realtime add table mega_coppa_seeding;
