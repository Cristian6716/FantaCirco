-- ============================================================================
-- Scambi tra rose: l'admin sposta giocatori (ed eventualmente crediti) tra due
-- squadre in un'unica operazione atomica. Ogni scambio viene salvato in modo
-- permanente (squadre e nomi giocatori come testo, oltre alle FK) così da poter
-- alimentare in futuro statistiche di mercato anche se account o giocatori
-- vengono in seguito rinominati/eliminati — stesso criterio di `storico_partite`
-- e `players.owner_team` (0014/0017).
-- ============================================================================

create table if not exists scambi (
  id bigint generated always as identity primary key,
  data timestamptz not null default now(),
  squadra_a text not null,
  squadra_b text not null,
  manager_a uuid references managers(id),
  manager_b uuid references managers(id),
  crediti_a int not null default 0 check (crediti_a >= 0),
  crediti_b int not null default 0 check (crediti_b >= 0),
  note text,
  created_by uuid references managers(id)
);
create index if not exists scambi_manager_a_idx on scambi(manager_a);
create index if not exists scambi_manager_b_idx on scambi(manager_b);

create table if not exists scambio_giocatori (
  id bigint generated always as identity primary key,
  scambio_id bigint not null references scambi(id) on delete cascade,
  player_id bigint references players(id) on delete set null,
  giocatore text not null,
  da text not null,
  a text not null
);
create index if not exists scambio_giocatori_scambio_idx on scambio_giocatori(scambio_id);
create index if not exists scambio_giocatori_player_idx on scambio_giocatori(player_id);

alter table scambi enable row level security;
alter table scambio_giocatori enable row level security;

create policy scambi_select on scambi for select to authenticated using (true);
create policy scambi_admin_delete on scambi for delete to authenticated using (is_admin());
create policy scambio_giocatori_select on scambio_giocatori for select to authenticated using (true);

alter publication supabase_realtime add table scambi;
alter publication supabase_realtime add table scambio_giocatori;

-- ---- esegui_scambio: sposta giocatori/crediti tra due rose e registra lo scambio ----
create or replace function esegui_scambio(
  p_manager_a uuid,
  p_manager_b uuid,
  p_players_a bigint[] default '{}',
  p_players_b bigint[] default '{}',
  p_crediti_a int default 0,
  p_crediti_b int default 0,
  p_note text default null
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_team_a text; v_team_b text;
  v_credits_a int; v_credits_b int;
  v_roster_a int; v_roster_b int;
  v_scambio_id bigint;
  v_pid bigint; v_pname text;
  v_players_a bigint[] := coalesce(p_players_a, '{}');
  v_players_b bigint[] := coalesce(p_players_b, '{}');
  v_crediti_a int := coalesce(p_crediti_a, 0);
  v_crediti_b int := coalesce(p_crediti_b, 0);
begin
  if not is_admin() then raise exception 'Solo un amministratore può eseguire scambi'; end if;
  if p_manager_a is null or p_manager_b is null or p_manager_a = p_manager_b then
    raise exception 'Seleziona due squadre diverse';
  end if;
  if v_crediti_a < 0 or v_crediti_b < 0 then raise exception 'Crediti non validi'; end if;
  if array_length(v_players_a, 1) is null and array_length(v_players_b, 1) is null
     and v_crediti_a = 0 and v_crediti_b = 0 then
    raise exception 'Nessun elemento da scambiare';
  end if;

  select coalesce(team_name, display_name), credits_total into v_team_a, v_credits_a
    from managers where id = p_manager_a for update;
  if not found then raise exception 'Squadra A inesistente'; end if;
  select coalesce(team_name, display_name), credits_total into v_team_b, v_credits_b
    from managers where id = p_manager_b for update;
  if not found then raise exception 'Squadra B inesistente'; end if;

  if v_crediti_a > v_credits_a then raise exception 'Crediti insufficienti per %', v_team_a; end if;
  if v_crediti_b > v_credits_b then raise exception 'Crediti insufficienti per %', v_team_b; end if;

  if exists (
    select 1 from players
    where id = any(v_players_a) and (assigned_to is distinct from p_manager_a or status <> 'assigned')
  ) then
    raise exception 'Uno o più giocatori non appartengono alla rosa di %', v_team_a;
  end if;
  if exists (
    select 1 from players
    where id = any(v_players_b) and (assigned_to is distinct from p_manager_b or status <> 'assigned')
  ) then
    raise exception 'Uno o più giocatori non appartengono alla rosa di %', v_team_b;
  end if;

  select count(*) into v_roster_a from players where assigned_to = p_manager_a and status = 'assigned';
  select count(*) into v_roster_b from players where assigned_to = p_manager_b and status = 'assigned';
  if v_roster_a - coalesce(array_length(v_players_a, 1), 0) + coalesce(array_length(v_players_b, 1), 0) > max_roster() then
    raise exception 'Rosa di % oltre il limite (max %)', v_team_a, max_roster();
  end if;
  if v_roster_b - coalesce(array_length(v_players_b, 1), 0) + coalesce(array_length(v_players_a, 1), 0) > max_roster() then
    raise exception 'Rosa di % oltre il limite (max %)', v_team_b, max_roster();
  end if;

  insert into scambi (squadra_a, squadra_b, manager_a, manager_b, crediti_a, crediti_b, note, created_by)
  values (v_team_a, v_team_b, p_manager_a, p_manager_b, v_crediti_a, v_crediti_b, p_note, auth.uid())
  returning id into v_scambio_id;

  foreach v_pid in array v_players_a loop
    select name into v_pname from players where id = v_pid;
    update players set assigned_to = p_manager_b, owner_team = v_team_b where id = v_pid;
    insert into scambio_giocatori (scambio_id, player_id, giocatore, da, a)
      values (v_scambio_id, v_pid, v_pname, v_team_a, v_team_b);
  end loop;

  foreach v_pid in array v_players_b loop
    select name into v_pname from players where id = v_pid;
    update players set assigned_to = p_manager_a, owner_team = v_team_a where id = v_pid;
    insert into scambio_giocatori (scambio_id, player_id, giocatore, da, a)
      values (v_scambio_id, v_pid, v_pname, v_team_b, v_team_a);
  end loop;

  if v_crediti_a > 0 then
    update managers set credits_total = credits_total - v_crediti_a where id = p_manager_a;
    update managers set credits_total = credits_total + v_crediti_a where id = p_manager_b;
  end if;
  if v_crediti_b > 0 then
    update managers set credits_total = credits_total - v_crediti_b where id = p_manager_b;
    update managers set credits_total = credits_total + v_crediti_b where id = p_manager_a;
  end if;

  perform _notify(p_manager_a, 'Scambio registrato',
    'Scambio con ' || v_team_b || ' registrato dall''amministratore.', '/profilo', 'scambio-' || v_scambio_id);
  perform _notify(p_manager_b, 'Scambio registrato',
    'Scambio con ' || v_team_a || ' registrato dall''amministratore.', '/profilo', 'scambio-' || v_scambio_id);

  return v_scambio_id;
end;
$$;
revoke all on function esegui_scambio(uuid, uuid, bigint[], bigint[], int, int, text) from public;
grant execute on function esegui_scambio(uuid, uuid, bigint[], bigint[], int, int, text) to authenticated;
