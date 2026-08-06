-- ============================================================================
-- Preferenze di notifica granulari + notifica obbligatoria di inizio asta.
-- ============================================================================

create table notification_preferences (
  manager_id uuid primary key references managers(id) on delete cascade,
  notify_outbid_phase1 boolean not null default true,
  notify_phase2_start boolean not null default true,
  notify_outbid_phase2 boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table notification_preferences enable row level security;
create policy notif_prefs_own on notification_preferences for all to authenticated
  using (manager_id = auth.uid()) with check (manager_id = auth.uid());
grant select, insert, update on notification_preferences to authenticated;

insert into notification_preferences (manager_id)
select id from managers
on conflict (manager_id) do nothing;

-- ---- Notifica filtrata per preferenza (la notifica di inizio asta e' sempre inviata) ----
create or replace function _notify_checked(p_manager uuid, p_kind text, p_title text, p_body text,
                                            p_url text default '/', p_tag text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_p1 boolean; v_p2s boolean; v_p2 boolean;
begin
  if p_kind = 'auction_start' then
    perform _notify(p_manager, p_title, p_body, p_url, p_tag);
    return;
  end if;

  select notify_outbid_phase1, notify_phase2_start, notify_outbid_phase2
    into v_p1, v_p2s, v_p2
  from notification_preferences where manager_id = p_manager;

  if (p_kind = 'outbid_phase1' and coalesce(v_p1, true))
     or (p_kind = 'phase2_start' and coalesce(v_p2s, true))
     or (p_kind = 'outbid_phase2' and coalesce(v_p2, true)) then
    perform _notify(p_manager, p_title, p_body, p_url, p_tag);
  end if;
end;
$$;

revoke execute on function _notify_checked(uuid, text, text, text, text, text) from anon, authenticated, public;

-- ---- place_bid: usa _notify_checked con il tipo giusto in base alla fase, e corregge il deep-link ----
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
    perform _notify_checked(v_prev_leader,
      case when a.status = 'phase1' then 'outbid_phase1' else 'outbid_phase2' end,
      'Sei stato superato!',
      v_player || ' e'' ora a ' || v_price || ' crediti.', '/asta/aste/' || p_auction, 'auction-' || p_auction);
  end if;
end;
$$;

-- ---- _advance_auction: notifica fine fase 1 filtrata + deep-link corretto ----
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
end;
$$;

-- ---- _end_auction: solo correzione deep-link ----
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
          'Aggiudicato per ' || a.current_bid || ' crediti.', '/asta/aste/' || p_auction, 'auction-' || p_auction);
      else
        perform _notify(r.manager_id, 'Asta conclusa: ' || v_player,
          coalesce(v_winner_name, 'Qualcuno') || ' ha vinto per ' || a.current_bid || ' crediti.',
          '/asta/aste/' || p_auction, 'auction-' || p_auction);
      end if;
    end loop;
  else
    update players set status = 'available', assigned_to = null where id = a.player_id;
  end if;
end;
$$;

-- ---- start_auction: aggiunge la notifica obbligatoria di inizio asta a tutti i manager ----
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
