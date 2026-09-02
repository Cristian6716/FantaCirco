-- ============================================================================
-- Chiusura del mercato: da un certo istante non si possono piu' avviare aste.
--
-- app_config.aste_chiusura_at tiene la deadline (null / chiave assente = nessun
-- blocco). Le aste gia' in corso proseguono normalmente: qui si blocca solo
-- l'apertura di nuove, dentro start_auction, quindi lato server.
--
-- Il frontend legge la stessa deadline da aste_chiusura_at() per mostrare il
-- conto alla rovescia.
-- ============================================================================

insert into app_config(key, value)
values ('aste_chiusura_at', '2026-09-02 16:00:00+02')
on conflict (key) do update set value = excluded.value;

create or replace function public.aste_chiusura_at() returns timestamptz
language sql stable security definer set search_path = public as $$
  select value::timestamptz from app_config where key = 'aste_chiusura_at';
$$;

comment on function public.aste_chiusura_at() is
  'Istante oltre il quale non si possono avviare nuove aste. Null = nessun blocco.';

create or replace function public.aste_bloccate() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(now() >= aste_chiusura_at(), false);
$$;

revoke execute on function public.aste_chiusura_at(), public.aste_bloccate() from anon, public;
grant execute on function public.aste_chiusura_at(), public.aste_bloccate() to authenticated;

-- ---- start_auction: stessa logica di 0011 piu' il blocco orario ----
create or replace function start_auction(p_player bigint, p_base int default 1,
  p_phase1_minutes int default 1440, p_phase2_minutes int default 1440) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_caller uuid := auth.uid(); v_auction bigint; v_avail int; v_status player_status;
  v_player_name text; r record;
begin
  if v_caller is null then raise exception 'Non autenticato'; end if;
  if not exists(select 1 from managers where id = v_caller) then raise exception 'Profilo non trovato'; end if;
  if aste_bloccate() then
    raise exception 'Mercato chiuso: dalle % non si possono avviare nuove aste',
      to_char(aste_chiusura_at() at time zone 'Europe/Rome', 'HH24:MI del DD/MM/YYYY'); end if;
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
