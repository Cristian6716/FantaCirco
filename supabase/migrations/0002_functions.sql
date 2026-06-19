-- ============================================================================
-- Funzioni dell'asta, RPC pubbliche/admin, tick e blocco permessi.
-- (riproduzione delle migrazioni 05/06/07/08/10 applicate)
-- ============================================================================

-- ---------- Funzioni interne ----------
create or replace function _end_auction(p_auction bigint) returns void
language plpgsql security definer set search_path = public as $$
declare a auctions; v_player text; v_winner_name text; r record;
begin
  select * into a from auctions where id = p_auction for update;
  if not found then return; end if;
  if a.status in ('ended','cancelled') then return; end if;
  select name into v_player from players where id = a.player_id;
  update auctions set status = 'ended', ended_at = now(), winner_id = a.leader_id where id = p_auction;
  update autobids set active = false where auction_id = p_auction and active;
  if a.leader_id is not null and a.current_bid > 0 then
    update players set status = 'assigned', assigned_to = a.leader_id where id = a.player_id;
    update managers set credits_total = credits_total - a.current_bid where id = a.leader_id;
    select display_name into v_winner_name from managers where id = a.leader_id;
    for r in select manager_id from auction_participants where auction_id = p_auction loop
      if r.manager_id = a.leader_id then
        perform _notify(r.manager_id, 'Hai vinto ' || v_player || '!',
          'Aggiudicato per ' || a.current_bid || ' crediti.', '/asta/' || p_auction, 'auction-' || p_auction);
      else
        perform _notify(r.manager_id, 'Asta conclusa: ' || v_player,
          coalesce(v_winner_name, 'Qualcuno') || ' ha vinto per ' || a.current_bid || ' crediti.',
          '/asta/' || p_auction, 'auction-' || p_auction);
      end if;
    end loop;
  else
    update players set status = 'available', assigned_to = null where id = a.player_id;
  end if;
end;
$$;

create or replace function _maybe_end_no_challengers(p_auction bigint) returns void
language plpgsql security definer set search_path = public as $$
declare a auctions; v_cnt int;
begin
  select * into a from auctions where id = p_auction for update;
  if not found then return; end if;
  if a.status <> 'phase2' then return; end if;
  select count(*) into v_cnt from auction_participants p
  where p.auction_id = p_auction and not p.withdrawn and p.manager_id is distinct from a.leader_id;
  if v_cnt = 0 then perform _end_auction(p_auction); end if;
end;
$$;

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
      perform _notify(r.manager_id, 'Fase 2: ' || v_player,
        'Ultime 24h, solo chi ha partecipato puo'' rilanciare.', '/asta/' || p_auction, 'auction-' || p_auction);
    end loop;
    perform _maybe_end_no_challengers(p_auction);
  end if;
end;
$$;

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

  select least(ab.max_amount, m.credits_total - (locked_credits(m.id) - a.current_bid))
    into v_leader_ceil
  from autobids ab join managers m on m.id = ab.manager_id
  where ab.auction_id = p_auction and ab.manager_id = v_leader and ab.active;
  if v_leader_ceil is null or v_leader_ceil < v_bid then v_leader_ceil := v_bid; end if;

  select ab.manager_id, least(ab.max_amount, m.credits_total - locked_credits(m.id))
    into v_chal_id, v_chal_ceil
  from autobids ab
  join managers m on m.id = ab.manager_id
  left join auction_participants p on p.auction_id = ab.auction_id and p.manager_id = ab.manager_id
  where ab.auction_id = p_auction and ab.active and ab.manager_id is distinct from v_leader
    and coalesce(p.withdrawn, false) = false
    and (a.status = 'phase1' or coalesce(p.joined_in_phase1, false))
  order by least(ab.max_amount, m.credits_total - locked_credits(m.id)) desc, ab.created_at asc
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

-- ---------- RPC pubbliche ----------
create or replace function start_auction(p_player bigint, p_base int default 1,
  p_phase1_minutes int default 1440, p_phase2_minutes int default 1440) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_caller uuid := auth.uid(); v_auction bigint; v_avail int; v_status player_status;
begin
  if v_caller is null then raise exception 'Non autenticato'; end if;
  if not exists(select 1 from managers where id = v_caller) then raise exception 'Profilo non trovato'; end if;
  if p_base < 1 then raise exception 'Prezzo base minimo 1'; end if;
  if p_phase1_minutes < 1 or p_phase2_minutes < 1 then raise exception 'Durate non valide'; end if;
  select status into v_status from players where id = p_player for update;
  if not found then raise exception 'Giocatore inesistente'; end if;
  if v_status <> 'available' then raise exception 'Giocatore non disponibile'; end if;
  v_avail := available_credits(v_caller);
  if p_base > v_avail then raise exception 'Crediti insufficienti (disponibili %)', v_avail; end if;
  insert into auctions(player_id, created_by, base_price, status, started_at, phase1_ends_at, phase2_ends_at, leader_id, current_bid)
  values (p_player, v_caller, p_base, 'phase1', now(),
          now() + make_interval(mins => p_phase1_minutes),
          now() + make_interval(mins => p_phase1_minutes + p_phase2_minutes), v_caller, p_base)
  returning id into v_auction;
  update players set status = 'in_auction' where id = p_player;
  insert into bids(auction_id, manager_id, amount, is_auto) values (v_auction, v_caller, p_base, false);
  insert into auction_participants(auction_id, manager_id, joined_in_phase1) values (v_auction, v_caller, true);
  return v_auction;
end;
$$;

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
  v_avail := available_credits(v_caller);
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
    perform _notify(v_prev_leader, 'Sei stato superato!',
      v_player || ' e'' ora a ' || v_price || ' crediti.', '/asta/' || p_auction, 'auction-' || p_auction);
  end if;
end;
$$;

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
  select credits_total - (locked_credits(v_caller) - case when a.leader_id = v_caller then a.current_bid else 0 end)
    into v_capacity from managers where id = v_caller;
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
    perform _notify(v_prev_leader, 'Sei stato superato!',
      v_player || ' e'' ora a ' || v_price || ' crediti.', '/asta/' || p_auction, 'auction-' || p_auction);
  end if;
end;
$$;

create or replace function withdraw(p_auction bigint) returns void
language plpgsql security definer set search_path = public as $$
declare a auctions; v_caller uuid := auth.uid();
begin
  if v_caller is null then raise exception 'Non autenticato'; end if;
  perform _advance_auction(p_auction);
  select * into a from auctions where id = p_auction for update;
  if not found then raise exception 'Asta inesistente'; end if;
  if a.status not in ('phase1','phase2') then raise exception 'Asta non attiva'; end if;
  if a.leader_id = v_caller then raise exception 'Sei in testa: non puoi ritirarti'; end if;
  if not exists(select 1 from auction_participants where auction_id = p_auction and manager_id = v_caller) then
    raise exception 'Non partecipi a questa asta'; end if;
  update auction_participants set withdrawn = true, withdrawn_at = now()
    where auction_id = p_auction and manager_id = v_caller;
  update autobids set active = false where auction_id = p_auction and manager_id = v_caller;
  perform _maybe_end_no_challengers(p_auction);
end;
$$;

-- ---------- RPC admin ----------
create or replace function _revert_auction_effects(p_auction bigint) returns void
language plpgsql security definer set search_path = public as $$
declare a auctions;
begin
  select * into a from auctions where id = p_auction for update;
  if not found then return; end if;
  if a.status = 'ended' and a.winner_id is not null and a.current_bid > 0 then
    update managers set credits_total = credits_total + a.current_bid where id = a.winner_id;
  end if;
  update players set status = 'available', assigned_to = null where id = a.player_id;
end;
$$;

create or replace function admin_pause_auction(p_auction bigint) returns void
language plpgsql security definer set search_path = public as $$
declare a auctions;
begin
  if not is_admin() then raise exception 'Solo admin'; end if;
  perform _advance_auction(p_auction);
  select * into a from auctions where id = p_auction for update;
  if not found then raise exception 'Asta inesistente'; end if;
  if a.status not in ('phase1','phase2') then raise exception 'Asta non in corso'; end if;
  update auctions set status = 'paused', paused_at = now() where id = p_auction;
end;
$$;

create or replace function admin_resume_auction(p_auction bigint) returns void
language plpgsql security definer set search_path = public as $$
declare a auctions; v_delta interval; v_p1 timestamptz; v_p2 timestamptz; v_status auction_status;
begin
  if not is_admin() then raise exception 'Solo admin'; end if;
  select * into a from auctions where id = p_auction for update;
  if not found then raise exception 'Asta inesistente'; end if;
  if a.status <> 'paused' then raise exception 'Asta non in pausa'; end if;
  v_delta := now() - a.paused_at;
  v_p1 := a.phase1_ends_at + v_delta; v_p2 := a.phase2_ends_at + v_delta;
  if now() >= v_p1 then v_status := 'phase2'; else v_status := 'phase1'; end if;
  update auctions set phase1_ends_at = v_p1, phase2_ends_at = v_p2, paused_at = null, status = v_status where id = p_auction;
  perform _advance_auction(p_auction);
  perform _maybe_end_no_challengers(p_auction);
end;
$$;

create or replace function admin_cancel_auction(p_auction bigint) returns void
language plpgsql security definer set search_path = public as $$
declare a auctions; v_player text; r record;
begin
  if not is_admin() then raise exception 'Solo admin'; end if;
  select * into a from auctions where id = p_auction for update;
  if not found then raise exception 'Asta inesistente'; end if;
  if a.status not in ('phase1','phase2','paused') then raise exception 'Asta non annullabile'; end if;
  select name into v_player from players where id = a.player_id;
  update autobids set active = false where auction_id = p_auction;
  update players set status = 'available', assigned_to = null where id = a.player_id;
  update auctions set status = 'cancelled', ended_at = now(), winner_id = null where id = p_auction;
  for r in select manager_id from auction_participants where auction_id = p_auction loop
    perform _notify(r.manager_id, 'Asta annullata',
      'L''asta per ' || v_player || ' e'' stata annullata dall''admin.', '/', 'auction-' || p_auction);
  end loop;
end;
$$;

create or replace function admin_delete_auction(p_auction bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo admin'; end if;
  perform _revert_auction_effects(p_auction);
  delete from auctions where id = p_auction;
end;
$$;

create or replace function admin_delete_all_auctions() returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo admin'; end if;
  update managers m set credits_total = credits_total + sub.amt
    from (select winner_id, sum(current_bid) amt from auctions
          where status = 'ended' and winner_id is not null group by winner_id) sub
   where m.id = sub.winner_id;
  update players set status = 'available', assigned_to = null;
  delete from auctions;
end;
$$;

-- ---------- Tick (pg_cron) ----------
create or replace function tick() returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select id from auctions
    where (status = 'phase1' and now() >= phase1_ends_at)
       or (status in ('phase1','phase2') and now() >= phase2_ends_at) loop
    perform _advance_auction(r.id);
  end loop;
end;
$$;

-- ---------- Blocco permessi (le funzioni interne non sono esposte all'API) ----------
revoke execute on function _advance_auction(bigint), _end_auction(bigint), _maybe_end_no_challengers(bigint),
  _resolve_autobids(bigint), _revert_auction_effects(bigint), _notify(uuid, text, text, text, text),
  locked_credits(uuid), available_credits(uuid), tick() from anon, authenticated, public;
revoke execute on function is_admin() from anon, public;
revoke execute on function start_auction(bigint, int, int, int), place_bid(bigint, int),
  set_autobid(bigint, int), withdraw(bigint), admin_pause_auction(bigint), admin_resume_auction(bigint),
  admin_cancel_auction(bigint), admin_delete_auction(bigint), admin_delete_all_auctions() from anon, public;
grant execute on function start_auction(bigint, int, int, int), place_bid(bigint, int),
  set_autobid(bigint, int), withdraw(bigint), admin_pause_auction(bigint), admin_resume_auction(bigint),
  admin_cancel_auction(bigint), admin_delete_auction(bigint), admin_delete_all_auctions() to authenticated;

-- ---------- Job pianificati ----------
-- select cron.schedule('fanta-tick', '* * * * *', $$ select public.tick(); $$);
-- select cron.schedule('fanta-push', '* * * * *',
--   $$ select net.http_post(url:='<PROJECT_URL>/functions/v1/process-outbox',
--        headers:=jsonb_build_object('Content-Type','application/json','x-cron-secret','<SECRET>'),
--        body:='{}'::jsonb) $$);
