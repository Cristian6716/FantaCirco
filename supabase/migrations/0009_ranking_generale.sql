-- ============================================================================
-- Ranking generale (stile UEFA) dello scorso anno: somma pesata di Campionato,
-- Battle Royale e Torneo. Snapshot storico precalcolato, non derivato in live
-- da punteggi_giornata (il Campionato/Torneo storico coinvolge 16 squadre,
-- 4 delle quali non hanno più un manager collegato quest'anno).
-- ============================================================================

create table if not exists ranking_generale (
  team_name text primary key,
  manager_id uuid references managers(id) on delete set null,
  manager_name text,
  pos int not null,
  campionato_pos int not null,
  campionato_pts int not null,
  royale_pos int not null,
  royale_pts int not null,
  torneo_detail text not null,
  torneo_pts int not null,
  torneo_campione boolean not null default false,
  totale int not null
);

alter table ranking_generale enable row level security;

create policy ranking_select on ranking_generale for select to authenticated using (true);
create policy ranking_admin_write on ranking_generale for all to authenticated using (is_admin()) with check (is_admin());

grant select, insert, update, delete on ranking_generale to authenticated;

alter publication supabase_realtime add table ranking_generale;
