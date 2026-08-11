-- ============================================================================
-- Svincolo giocatore: il proprietario (o l'admin) può rimettere un giocatore
-- della propria rosa tra gli svincolati, con rimborso totale dei crediti
-- pagati per aggiudicarlo.
-- ============================================================================

create or replace function release_player(p_player bigint) returns void
language plpgsql security definer set search_path = public as $$
declare v_player players; v_caller uuid := auth.uid();
begin
  if v_caller is null then raise exception 'Non autenticato'; end if;
  select * into v_player from players where id = p_player for update;
  if not found then raise exception 'Giocatore inesistente'; end if;
  if v_player.status <> 'assigned' then raise exception 'Il giocatore non è in una rosa'; end if;
  if v_player.assigned_to is distinct from v_caller and not is_admin() then
    raise exception 'Puoi svincolare solo i giocatori della tua rosa';
  end if;
  if v_player.assigned_to is not null and v_player.price is not null and v_player.price > 0 then
    update managers set credits_total = credits_total + v_player.price where id = v_player.assigned_to;
  end if;
  update players set status = 'available', assigned_to = null, owner_team = null, price = null
    where id = p_player;
end;
$$;
revoke all on function release_player(bigint) from public;
grant execute on function release_player(bigint) to authenticated;
