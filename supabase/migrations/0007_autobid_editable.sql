-- ============================================================================
-- Autobid modificabile: il tetto puo' anche essere abbassato (mai sotto il
-- prezzo attuale se sei in testa), e puo' essere annullato del tutto senza
-- dover uscire dall'asta (a differenza di withdraw(), non richiede che tu non
-- sia in testa: annullare l'autobid non tocca il current_bid, smette solo di
-- rilanciare automaticamente per te).
-- ============================================================================

create or replace function set_autobid(p_auction bigint, p_max int) returns void
language plpgsql security definer set search_path = public as $$
declare a auctions; v_caller uuid := auth.uid(); v_capacity int; v_min int;
  v_prev_leader uuid; v_new_leader uuid; v_player text; v_price int;
begin
  if v_caller is null then raise exception 'Non autenticato'; end if;
  perform _advance_auction(p_auction);
  select * into a from auctions where id = p_auction for update;
  if not found then raise exception 'Asta inesistente'; end if;
  if a.status not in ('phase1','phase2') then raise exception 'Asta non attiva'; end if;
  if a.status = 'phase2' and not exists(select 1 from auction_participants
       where auction_id = p_auction and manager_id = v_caller and joined_in_phase1) then
    raise exception 'Fase 2: non hai partecipato alla fase 1'; end if;
  if exists(select 1 from auction_participants where auction_id = p_auction and manager_id = v_caller and withdrawn) then
    raise exception 'Ti sei ritirato da questa asta'; end if;
  select credits_total - (locked_credits(v_caller) - case when a.leader_id = v_caller then a.current_bid else 0 end)
    into v_capacity from managers where id = v_caller;
  if p_max > v_capacity then raise exception 'Tetto oltre i crediti disponibili (max %)', v_capacity; end if;
  v_min := case when a.leader_id = v_caller then a.current_bid else a.current_bid + 1 end;
  if p_max < v_min then raise exception 'Il tetto deve essere almeno %', v_min; end if;
  insert into autobids(auction_id, manager_id, max_amount, active, updated_at)
    values (p_auction, v_caller, p_max, true, now())
    on conflict (auction_id, manager_id) do update set max_amount = excluded.max_amount, active = true, updated_at = now();
  insert into auction_participants(auction_id, manager_id, joined_in_phase1)
    values (p_auction, v_caller, a.status = 'phase1') on conflict (auction_id, manager_id) do nothing;
  v_prev_leader := a.leader_id;
  perform _resolve_autobids(p_auction);
  select leader_id, current_bid into v_new_leader, v_price from auctions where id = p_auction;
  if v_prev_leader is not null and v_new_leader is distinct from v_prev_leader then
    select name into v_player from players where id = a.player_id;
    perform _notify(v_prev_leader, 'Sei stato superato!',
      v_player || ' e'' ora a ' || v_price || ' crediti.', '/asta/' || p_auction, 'auction-' || p_auction);
  end if;
end;
$$;

create or replace function cancel_autobid(p_auction bigint) returns void
language plpgsql security definer set search_path = public as $$
declare a auctions; v_caller uuid := auth.uid();
begin
  if v_caller is null then raise exception 'Non autenticato'; end if;
  perform _advance_auction(p_auction);
  select * into a from auctions where id = p_auction for update;
  if not found then raise exception 'Asta inesistente'; end if;
  if a.status not in ('phase1','phase2') then raise exception 'Asta non attiva'; end if;
  if not exists(select 1 from autobids where auction_id = p_auction and manager_id = v_caller and active) then
    raise exception 'Non hai un autobid attivo su questa asta'; end if;
  update autobids set active = false, updated_at = now() where auction_id = p_auction and manager_id = v_caller;
end;
$$;

revoke execute on function cancel_autobid(bigint) from anon, public;
grant execute on function cancel_autobid(bigint) to authenticated;
