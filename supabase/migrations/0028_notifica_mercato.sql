-- ============================================================================
-- Notifica «nuovo giocatore sul mercato».
--
-- Quando qualcuno pubblica un annuncio sulla bacheca del mercato (0026), tutti
-- gli altri fantallenatori ricevono un push. E' l'unica notifica non legata
-- alle aste, quindi nasce spenta: chi la vuole la accende dal Profilo.
--
-- Solo sull'INSERT: modificare un annuncio gia' in vetrina (il client fa
-- upsert su player_id) non e' una novita' e non deve rinotificare nessuno.
-- ============================================================================

alter table notification_preferences
  add column if not exists notify_mercato_annuncio boolean not null default false;

-- ---- _notify_checked: aggiunge il tipo 'mercato_annuncio' ----
create or replace function _notify_checked(p_manager uuid, p_kind text, p_title text, p_body text,
                                            p_url text default '/', p_tag text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_p1 boolean; v_p2s boolean; v_p2 boolean; v_merc boolean;
begin
  if p_kind = 'auction_start' then
    perform _notify(p_manager, p_title, p_body, p_url, p_tag);
    return;
  end if;

  select notify_outbid_phase1, notify_phase2_start, notify_outbid_phase2, notify_mercato_annuncio
    into v_p1, v_p2s, v_p2, v_merc
  from notification_preferences where manager_id = p_manager;

  if (p_kind = 'outbid_phase1' and coalesce(v_p1, true))
     or (p_kind = 'phase2_start' and coalesce(v_p2s, true))
     or (p_kind = 'outbid_phase2' and coalesce(v_p2, true))
     -- Opt-in: senza riga di preferenze la notifica di mercato non parte.
     or (p_kind = 'mercato_annuncio' and coalesce(v_merc, false)) then
    perform _notify(p_manager, p_title, p_body, p_url, p_tag);
  end if;
end;
$$;

revoke execute on function _notify_checked(uuid, text, text, text, text, text) from anon, authenticated, public;

-- ---- Trigger: annuncio pubblicato -> avvisa tutti gli altri ----
create or replace function public.mercato_notifica_annuncio()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_player text;
  v_team text;
  r record;
begin
  select name into v_player from players where id = new.player_id;
  select coalesce(team_name, display_name) into v_team from managers where id = new.manager_id;

  for r in select id from managers where id <> new.manager_id loop
    perform _notify_checked(r.id, 'mercato_annuncio',
      'Nuovo sul mercato: ' || coalesce(v_player, 'un giocatore'),
      coalesce(v_team, 'Un fantallenatore') || ' lo mette in vetrina. Vedi cosa chiede in cambio.',
      '/asta/mercato', 'mercato-' || new.player_id);
  end loop;
  return new;
end;
$$;

drop trigger if exists mercato_annunci_notifica on mercato_annunci;
create trigger mercato_annunci_notifica
  after insert on mercato_annunci
  for each row execute function public.mercato_notifica_annuncio();
