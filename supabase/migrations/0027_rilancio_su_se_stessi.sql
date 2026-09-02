-- Rilancio consentito anche a chi e' gia' in testa: place_bid non blocca piu'
-- il leader, che puo' alzare la propria offerta (sempre di almeno +1).
create or replace function place_bid(p_auction bigint, p_amount int) returns void
language plpgsql security definer set search_path = public as $$
declare a auctions; v_caller uuid := auth.uid(); v_avail int; v_min int;
  v_prev_leader uuid; v_new_leader uuid; v_player text; v_price int; v_expired uuid[];
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
  v_min := a.current_bid + 1;
  if p_amount < v_min then raise exception 'Offerta troppo bassa (minimo %)', v_min; end if;
  if roster_committed(v_caller, p_auction) >= max_roster() then
    raise exception 'Rosa al completo (max % giocatori, aste in corso incluse)', max_roster(); end if;
  select credits_total - committed_credits(v_caller, p_auction) into v_avail
    from managers where id = v_caller;
  if p_amount > v_avail then raise exception 'Crediti insufficienti (disponibili %)', v_avail; end if;
  v_prev_leader := a.leader_id;
  update auctions set leader_id = v_caller, current_bid = p_amount where id = p_auction;
  insert into bids(auction_id, manager_id, amount, is_auto) values (p_auction, v_caller, p_amount, false);
  insert into auction_participants(auction_id, manager_id, joined_in_phase1)
    values (p_auction, v_caller, a.status = 'phase1') on conflict (auction_id, manager_id) do nothing;
  perform _resolve_autobids(p_auction);
  v_expired := _expire_autobids(p_auction);
  select leader_id, current_bid into v_new_leader, v_price from auctions where id = p_auction;
  if v_prev_leader is not null and v_new_leader is distinct from v_prev_leader
     and not (v_prev_leader = any(v_expired)) then
    select name into v_player from players where id = a.player_id;
    perform _notify_checked(v_prev_leader,
      case when a.status = 'phase1' then 'outbid_phase1' else 'outbid_phase2' end,
      'Sei stato superato!',
      v_player || ' e'' ora a ' || v_price || ' crediti.', '/asta/aste/' || p_auction, 'auction-' || p_auction);
  end if;
end;
$$;
