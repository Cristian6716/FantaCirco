-- ============================================================================
-- Limite di rosa: nessuno puo' impegnarsi su piu' giocatori di quanti ne
-- entrino in rosa (33 di default, modificabile da app_config.max_roster).
--
-- Uno slot e' occupato dai giocatori gia' aggiudicati piu' dagli "impegni
-- aperti": le aste in corso dove sei in testa o hai un auto-bid attivo.
-- Stesso criterio del blocco crediti (0010), cosi' offerte e auto-bid sono
-- soggetti allo stesso limite.
-- ============================================================================

insert into app_config(key, value) values ('max_roster', '33')
on conflict (key) do nothing;

create or replace function max_roster() returns int
language sql stable security definer set search_path = public as $$
  select coalesce((select value::int from app_config where key = 'max_roster'), 33);
$$;

create or replace function roster_committed(p_manager uuid, p_exclude bigint default null)
returns int language sql stable security definer set search_path = public as $$
  select (
    (select count(*) from players
      where assigned_to = p_manager and status = 'assigned')
    +
    (select count(*) from auctions a
       left join autobids ab on ab.auction_id = a.id and ab.manager_id = p_manager and ab.active
      where a.status in ('phase1','phase2','paused')
        and (a.leader_id = p_manager or ab.manager_id is not null)
        and (p_exclude is null or a.id <> p_exclude))
  )::int;
$$;

-- La vista dei crediti porta anche gli slot: la usa gia' il frontend.
drop view if exists v_manager_credits;
create view v_manager_credits with (security_invoker = on) as
select m.id, m.username, m.display_name, m.team_name, m.credits_total, m.is_admin,
       locked_credits(m.id) as locked,
       (m.credits_total - locked_credits(m.id))::int as available,
       roster_committed(m.id, null) as roster_used,
       max_roster() as roster_max,
       (max_roster() - roster_committed(m.id, null))::int as roster_free
from managers m;
grant select on v_manager_credits to authenticated;

-- ---- start_auction: avviare un'asta occupa uno slot ----
create or replace function start_auction(p_player bigint, p_base int default 1,
  p_phase1_minutes int default 1440, p_phase2_minutes int default 1440) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_caller uuid := auth.uid(); v_auction bigint; v_avail int; v_status player_status;
  v_player_name text; r record;
begin
  if v_caller is null then raise exception 'Non autenticato'; end if;
  if not exists(select 1 from managers where id = v_caller) then raise exception 'Profilo non trovato'; end if;
  if p_base < 1 then raise exception 'Prezzo base minimo 1'; end if;
  if p_phase1_minutes < 1 or p_phase2_minutes < 1 then raise exception 'Durate non valide'; end if;
  select status into v_status from players where id = p_player for update;
  if not found then raise exception 'Giocatore inesistente'; end if;
  if v_status <> 'available' then raise exception 'Giocatore non disponibile'; end if;
  if roster_committed(v_caller, null) >= max_roster() then
    raise exception 'Rosa al completo (max % giocatori, aste in corso incluse)', max_roster(); end if;
  v_avail := available_credits(v_caller);
  if p_base > v_avail then raise exception 'Crediti insufficienti (disponibili %)', v_avail; end if;
  select name into v_player_name from players where id = p_player;
  insert into auctions(player_id, created_by, base_price, status, started_at, phase1_ends_at, phase2_ends_at, leader_id, current_bid)
  values (p_player, v_caller, p_base, 'phase1', now(),
          now() + make_interval(mins => p_phase1_minutes),
          now() + make_interval(mins => p_phase1_minutes + p_phase2_minutes), v_caller, p_base)
  returning id into v_auction;
  update players set status = 'in_auction' where id = p_player;
  insert into bids(auction_id, manager_id, amount, is_auto) values (v_auction, v_caller, p_base, false);
  insert into auction_participants(auction_id, manager_id, joined_in_phase1) values (v_auction, v_caller, true);
  for r in select id from managers where id <> v_caller loop
    perform _notify(r.id, 'Nuova asta: ' || v_player_name,
      'Base ' || p_base || ' crediti. Parti a fare la tua offerta!', '/asta/aste/' || v_auction, 'auction-' || v_auction);
  end loop;
  return v_auction;
end;
$$;

-- ---- place_bid: blocco rosa oltre a quello crediti ----
create or replace function place_bid(p_auction bigint, p_amount int) returns void
language plpgsql security definer set search_path = public as $$
declare a auctions; v_caller uuid := auth.uid(); v_avail int; v_min int;
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
  select leader_id, current_bid into v_new_leader, v_price from auctions where id = p_auction;
  if v_prev_leader is not null and v_new_leader is distinct from v_prev_leader then
    select name into v_player from players where id = a.player_id;
    perform _notify_checked(v_prev_leader,
      case when a.status = 'phase1' then 'outbid_phase1' else 'outbid_phase2' end,
      'Sei stato superato!',
      v_player || ' e'' ora a ' || v_price || ' crediti.', '/asta/aste/' || p_auction, 'auction-' || p_auction);
  end if;
end;
$$;

-- ---- set_autobid: stesso blocco rosa delle offerte ----
create or replace function set_autobid(p_auction bigint, p_max int) returns void
language plpgsql security definer set search_path = public as $$
declare a auctions; v_caller uuid := auth.uid(); v_capacity int; v_existing int; v_min int;
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
  select leader_id, current_bid into v_new_leader, v_price from auctions where id = p_auction;
  if v_prev_leader is not null and v_new_leader is distinct from v_prev_leader then
    select name into v_player from players where id = a.player_id;
    perform _notify_checked(v_prev_leader,
      case when a.status = 'phase1' then 'outbid_phase1' else 'outbid_phase2' end,
      'Sei stato superato!',
      v_player || ' e'' ora a ' || v_price || ' crediti.', '/asta/aste/' || p_auction, 'auction-' || p_auction);
  end if;
end;
$$;

-- ---- _resolve_autobids: un auto-bid non rilancia se la rosa e' gia' piena ----
create or replace function _resolve_autobids(p_auction bigint) returns void
language plpgsql security definer set search_path = public as $$
declare
  a auctions; v_leader uuid; v_bid int; v_leader_ceil int;
  v_chal_id uuid; v_chal_ceil int; v_new_leader uuid; v_new_price int;
begin
  select * into a from auctions where id = p_auction for update;
  if not found then return; end if;
  if a.status not in ('phase1','phase2') then return; end if;
  v_leader := a.leader_id; v_bid := a.current_bid;

  select least(ab.max_amount, m.credits_total - committed_credits(m.id, p_auction))
    into v_leader_ceil
  from autobids ab join managers m on m.id = ab.manager_id
  where ab.auction_id = p_auction and ab.manager_id = v_leader and ab.active;
  if v_leader_ceil is null or v_leader_ceil < v_bid then v_leader_ceil := v_bid; end if;

  select ab.manager_id, least(ab.max_amount, m.credits_total - committed_credits(m.id, p_auction))
    into v_chal_id, v_chal_ceil
  from autobids ab
  join managers m on m.id = ab.manager_id
  left join auction_participants p on p.auction_id = ab.auction_id and p.manager_id = ab.manager_id
  where ab.auction_id = p_auction and ab.active and ab.manager_id is distinct from v_leader
    and coalesce(p.withdrawn, false) = false
    and (a.status = 'phase1' or coalesce(p.joined_in_phase1, false))
    and roster_committed(ab.manager_id, p_auction) < max_roster()
  order by least(ab.max_amount, m.credits_total - committed_credits(m.id, p_auction)) desc, ab.created_at asc
  limit 1;

  if v_chal_id is null or v_chal_ceil <= v_bid then return; end if;

  if v_chal_ceil > v_leader_ceil then
    v_new_leader := v_chal_id; v_new_price := v_leader_ceil + 1;
  elsif v_chal_ceil = v_leader_ceil then
    v_new_leader := v_leader; v_new_price := v_leader_ceil;
  else
    v_new_leader := v_leader; v_new_price := v_chal_ceil + 1;
  end if;
  if v_new_price > greatest(v_leader_ceil, v_chal_ceil) then
    v_new_price := greatest(v_leader_ceil, v_chal_ceil);
  end if;
  if v_new_price <= v_bid then return; end if;

  update auctions set leader_id = v_new_leader, current_bid = v_new_price where id = p_auction;
  insert into bids(auction_id, manager_id, amount, is_auto) values (p_auction, v_new_leader, v_new_price, true);
end;
$$;

revoke execute on function roster_committed(uuid, bigint) from anon, authenticated, public;
revoke execute on function max_roster() from anon, public;
grant execute on function max_roster() to authenticated;
