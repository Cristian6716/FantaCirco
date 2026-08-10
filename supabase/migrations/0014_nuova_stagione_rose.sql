-- ============================================================================
-- Nuova stagione: le rose complete vivono in `players`, non solo gli svincolati.
--
-- Ogni giocatore porta con sé i dati del listone (prezzo pagato all'asta estiva,
-- quotazioni, ruolo classic, id Fantacalcio) e la squadra proprietaria come
-- testo (`owner_team`). Il testo serve perché una rosa può esistere prima del
-- suo account: `claim_team` la aggancia quando il fantallenatore si registra.
-- ============================================================================

alter table players
  add column if not exists owner_team text,
  add column if not exists price int,
  add column if not exists ruolo text,
  add column if not exists quotazione int,
  add column if not exists quotazione_mantra int,
  add column if not exists fantacalcio_id int;

create index if not exists players_owner_team_idx on players(owner_team);

comment on column players.owner_team is
  'Nome della squadra proprietaria. Popolato per i giocatori di rosa, null per gli svincolati.';
comment on column players.price is
  'Crediti pagati all''asta estiva (rose) o all''asta dinamica (svincolati aggiudicati).';

-- ---- Aggiudicazione: registra anche prezzo e squadra proprietaria ----
-- _end_auction assegna il giocatore al vincitore; da ora tiene traccia di
-- quanto è costato e di quale rosa lo possiede, come per i giocatori importati.
create or replace function _end_auction(p_auction bigint) returns void
language plpgsql security definer set search_path = public as $$
declare a auctions; v_player text; v_winner_name text; v_team text; r record;
begin
  select * into a from auctions where id = p_auction for update;
  if not found then return; end if;
  if a.status in ('ended','cancelled') then return; end if;
  select name into v_player from players where id = a.player_id;
  update auctions set status = 'ended', ended_at = now(), winner_id = a.leader_id where id = p_auction;
  update autobids set active = false where auction_id = p_auction and active;
  if a.leader_id is not null and a.current_bid > 0 then
    select display_name, coalesce(team_name, display_name)
      into v_winner_name, v_team from managers where id = a.leader_id;
    update players set status = 'assigned', assigned_to = a.leader_id,
                       owner_team = v_team, price = a.current_bid
      where id = a.player_id;
    update managers set credits_total = credits_total - a.current_bid where id = a.leader_id;
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
    update players set status = 'available', assigned_to = null, owner_team = null, price = null
      where id = a.player_id;
  end if;
end;
$$;

-- ---- Reset degli effetti di un'asta (annullamento admin) ----
-- Rimette il giocatore tra gli svincolati ripulendo anche i nuovi campi.
create or replace function _revert_auction_effects(p_auction bigint) returns void
language plpgsql security definer set search_path = public as $$
declare a auctions;
begin
  select * into a from auctions where id = p_auction for update;
  if not found then return; end if;
  if a.status = 'ended' and a.winner_id is not null and a.current_bid > 0 then
    update managers set credits_total = credits_total + a.current_bid where id = a.winner_id;
  end if;
  update players
     set status = 'available', assigned_to = null, owner_team = null, price = null
   where id = a.player_id;
end;
$$;

-- ---- claim_team: aggancia la rosa già importata e allinea i crediti ----
-- Il budget di partenza è 500: chi si registra dopo l'importazione si ritrova
-- i crediti residui della propria asta estiva, non 500 pieni.
create or replace function claim_team(p_team_name text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_current text;
  v_spent int;
begin
  select team_name into v_current from managers where id = auth.uid();
  if v_current is not null then
    raise exception 'Hai già scelto una squadra: non puoi cambiarla.';
  end if;
  if p_team_name is null or btrim(p_team_name) = '' then
    raise exception 'Nome squadra non valido.';
  end if;

  update managers set team_name = p_team_name, display_name = p_team_name
    where id = auth.uid() and team_name is null;

  if not found then
    raise exception 'Impossibile assegnare la squadra.';
  end if;

  update partite set casa_manager = auth.uid() where casa = p_team_name;
  update partite set trasferta_manager = auth.uid() where trasferta = p_team_name;

  -- Rosa importata prima della registrazione: la collega e scala il budget.
  update players set assigned_to = auth.uid()
    where owner_team = p_team_name and assigned_to is null and status = 'assigned';

  select coalesce(sum(price), 0) into v_spent
    from players where owner_team = p_team_name and status = 'assigned';
  if v_spent > 0 then
    update managers set credits_total = greatest(0, 500 - v_spent) where id = auth.uid();
  end if;
exception
  when unique_violation then
    raise exception 'Questa squadra è già stata scelta da qualcun altro.';
end;
$$;
revoke all on function claim_team(text) from public;
grant execute on function claim_team(text) to authenticated;
