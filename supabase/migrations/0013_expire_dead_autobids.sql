-- ============================================================================
-- Gli auto-bid "morti" non devono piu' bloccare crediti e slot rosa.
--
-- Dalla 0010 il tetto di un auto-bid attivo impegna crediti come un'offerta.
-- Mancava pero' la chiusura del ciclo: quando l'auto-bid smette di poter
-- rilanciare, restava active = true e continuava a bloccare l'intero tetto
-- finche' il manager non lo rimuoveva a mano. Due casi reali:
--
--   1) il prezzo supera il tetto (tetto 331, asta a 332): l'auto-bid non
--      potra' mai piu' rilanciare, ma bloccava 331 crediti;
--   2) il tetto e' alto ma il tetto EFFETTIVO e' tagliato dai crediti
--      impegnati sulle altre aste (tetto 400 su 500 crediti, ma con 383 gia'
--      impegnati altrove l'auto-bid si ferma a 117): l'auto-bid viene
--      superato a 118 e continua a bloccare 400 crediti - crediti che a loro
--      volta abbassano il tetto effettivo ovunque.
--
-- Ora, dopo ogni variazione di prezzo, gli auto-bid di chi non e' in testa
-- che non possono piu' rilanciare vengono disattivati automaticamente, con
-- notifica: i crediti e lo slot rosa tornano subito disponibili e il manager
-- puo' rimettere un tetto nuovo (piu' alto o piu' basso) se vuole.
-- ============================================================================

-- ---- Disattiva gli auto-bid che non possono piu' prendere la testa ----
-- Ritorna i manager disattivati, cosi' chi chiama evita la notifica doppia
-- "sei stato superato" + "auto-bid disattivato".
create or replace function _expire_autobids(p_auction bigint, p_notify boolean default true) returns uuid[]
language plpgsql security definer set search_path = public as $$
declare a auctions; v_player text; v_expired uuid[] := '{}'; v_body text; r record;
begin
  select * into a from auctions where id = p_auction;
  if not found then return v_expired; end if;
  if a.status not in ('phase1','phase2') then return v_expired; end if;
  select name into v_player from players where id = a.player_id;

  for r in
    select ab.manager_id, ab.max_amount,
           least(ab.max_amount, m.credits_total - committed_credits(m.id, p_auction)) as ceil,
           (a.status = 'phase2' and not coalesce(p.joined_in_phase1, false)) as no_phase1,
           (roster_committed(ab.manager_id, p_auction) >= max_roster()) as roster_full
    from autobids ab
    join managers m on m.id = ab.manager_id
    left join auction_participants p on p.auction_id = ab.auction_id and p.manager_id = ab.manager_id
    where ab.auction_id = p_auction and ab.active
      and ab.manager_id is distinct from a.leader_id
      and coalesce(p.withdrawn, false) = false
  loop
    if not (r.ceil <= a.current_bid or r.no_phase1 or r.roster_full) then continue; end if;

    update autobids set active = false, updated_at = now()
      where auction_id = p_auction and manager_id = r.manager_id;
    v_expired := v_expired || r.manager_id;

    if not p_notify then continue; end if;

    v_body := case
      when r.no_phase1 then
        'Fase 2 su ' || v_player || ': non avevi partecipato alla fase 1, l''auto-bid non puo'' rilanciare.'
      when r.roster_full then
        'Rosa al completo: l''auto-bid su ' || v_player || ' non puo'' rilanciare.'
      when r.max_amount <= a.current_bid then
        v_player || ' e'' a ' || a.current_bid || ' crediti, oltre il tuo tetto di ' || r.max_amount || '.'
      else
        v_player || ' e'' a ' || a.current_bid || ' crediti: i crediti liberi non bastavano per rilanciare (tetto effettivo ' || greatest(r.ceil, 0) || ').'
    end || ' Auto-bid disattivato: ' || r.max_amount || ' crediti di nuovo disponibili.';

    perform _notify(r.manager_id, 'Auto-bid disattivato', v_body,
      '/asta/aste/' || p_auction, 'autobid-' || p_auction);
  end loop;
  return v_expired;
end;
$$;

-- ---- place_bid: pulizia degli auto-bid morti subito dopo la risoluzione ----
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
  if a.leader_id = v_caller then raise exception 'Sei gia'' in testa'; end if;
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

-- ---- set_autobid: idem ----
create or replace function set_autobid(p_auction bigint, p_max int) returns void
language plpgsql security definer set search_path = public as $$
declare a auctions; v_caller uuid := auth.uid(); v_capacity int; v_existing int; v_min int;
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
  if roster_committed(v_caller, p_auction) >= max_roster() then
    raise exception 'Rosa al completo (max % giocatori, aste in corso incluse)', max_roster(); end if;
  select credits_total - committed_credits(v_caller, p_auction) into v_capacity
    from managers where id = v_caller;
  if p_max > v_capacity then raise exception 'Tetto oltre i crediti disponibili (max %)', v_capacity; end if;
  v_min := case when a.leader_id = v_caller then a.current_bid else a.current_bid + 1 end;
  if p_max < v_min then raise exception 'Il tetto deve essere almeno %', v_min; end if;
  select max_amount into v_existing from autobids where auction_id = p_auction and manager_id = v_caller and active;
  if v_existing is not null and p_max < v_existing then raise exception 'Non puoi abbassare il tetto (attuale %)', v_existing; end if;
  insert into autobids(auction_id, manager_id, max_amount, active, updated_at)
    values (p_auction, v_caller, p_max, true, now())
    on conflict (auction_id, manager_id) do update set max_amount = excluded.max_amount, active = true, updated_at = now();
  insert into auction_participants(auction_id, manager_id, joined_in_phase1)
    values (p_auction, v_caller, a.status = 'phase1') on conflict (auction_id, manager_id) do nothing;
  v_prev_leader := a.leader_id;
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

-- ---- _advance_auction: pulizia anche su passaggio di fase, ripresa da pausa e tick ----
create or replace function _advance_auction(p_auction bigint) returns void
language plpgsql security definer set search_path = public as $$
declare a auctions; v_player text; r record;
begin
  select * into a from auctions where id = p_auction for update;
  if not found then return; end if;
  if a.status in ('ended','cancelled','paused') then return; end if;
  if now() >= a.phase2_ends_at then perform _end_auction(p_auction); return; end if;
  if a.status = 'phase1' and now() >= a.phase1_ends_at then
    update auctions set status = 'phase2' where id = p_auction;
    select name into v_player from players where id = a.player_id;
    for r in select manager_id from auction_participants
             where auction_id = p_auction and joined_in_phase1 and not withdrawn loop
      perform _notify_checked(r.manager_id, 'phase2_start', 'Fase 2: ' || v_player,
        'Ultime 24h, solo chi ha partecipato puo'' rilanciare.', '/asta/aste/' || p_auction, 'auction-' || p_auction);
    end loop;
    perform _maybe_end_no_challengers(p_auction);
  end if;
  perform _expire_autobids(p_auction);
end;
$$;

revoke execute on function _expire_autobids(bigint, boolean) from anon, authenticated, public;

-- ---- Bonifica una tantum degli auto-bid gia' morti, senza notifiche ----
-- (si riferirebbero a rilanci di ore fa: i crediti tornano liberi in silenzio)
do $$
declare r record;
begin
  for r in select id from auctions where status in ('phase1','phase2') loop
    perform _expire_autobids(r.id, false);
  end loop;
end $$;
