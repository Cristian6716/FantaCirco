-- ============================================================================
-- Promemoria «mancano 3 ore alla chiusura dei pronostici».
--
-- Tre ore prima di giornate.chiusura_at (0022) parte un push a tutti: ricorda
-- di mandare i pronostici e di mettere la formazione. Cliccando si finisce
-- dritti su /pronostici/pronostica.
--
-- Attiva di default per tutti, disattivabile dal Profilo.
--
-- giornate.promemoria_3h_at segna l'invio: il tick gira ogni minuto e senza
-- quel timbro rispedirebbe il promemoria sessanta volte. Lo scriviamo prima
-- di notificare, cosi' un errore a meta' ciclo non genera un secondo invio.
-- ============================================================================

alter table notification_preferences
  add column if not exists notify_promemoria_pronostici boolean not null default true;

alter table giornate add column if not exists promemoria_3h_at timestamptz;

comment on column giornate.promemoria_3h_at is
  'Istante in cui e'' stato inviato il promemoria delle 3 ore. Null = mai inviato.';

-- ---- _notify_checked: aggiunge il tipo 'promemoria_pronostici' ----
create or replace function _notify_checked(p_manager uuid, p_kind text, p_title text, p_body text,
                                            p_url text default '/', p_tag text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_p1 boolean; v_p2s boolean; v_p2 boolean; v_merc boolean; v_pron boolean;
begin
  if p_kind = 'auction_start' then
    perform _notify(p_manager, p_title, p_body, p_url, p_tag);
    return;
  end if;

  select notify_outbid_phase1, notify_phase2_start, notify_outbid_phase2,
         notify_mercato_annuncio, notify_promemoria_pronostici
    into v_p1, v_p2s, v_p2, v_merc, v_pron
  from notification_preferences where manager_id = p_manager;

  if (p_kind = 'outbid_phase1' and coalesce(v_p1, true))
     or (p_kind = 'phase2_start' and coalesce(v_p2s, true))
     or (p_kind = 'outbid_phase2' and coalesce(v_p2, true))
     -- Opt-in: senza riga di preferenze la notifica di mercato non parte.
     or (p_kind = 'mercato_annuncio' and coalesce(v_merc, false))
     or (p_kind = 'promemoria_pronostici' and coalesce(v_pron, true)) then
    perform _notify(p_manager, p_title, p_body, p_url, p_tag);
  end if;
end;
$$;

revoke execute on function _notify_checked(uuid, text, text, text, text, text) from anon, authenticated, public;

-- ---- Promemoria: chiamato dal tick ogni minuto ----
create or replace function public._promemoria_pronostici()
returns void language plpgsql security definer set search_path = public as $$
declare g record; r record;
begin
  for g in
    select numero, chiusura_at from giornate
    where chiusura_at is not null
      and not pronostici_chiusi
      and promemoria_3h_at is null
      and now() >= chiusura_at - interval '3 hours'
      -- Se la deadline e' gia' passata (giornata vecchia, o deadline impostata
      -- all'ultimo) il promemoria non ha piu' senso: lo saltiamo.
      and now() < chiusura_at
  loop
    update giornate set promemoria_3h_at = now() where numero = g.numero;

    for r in select id from managers loop
      perform _notify_checked(r.id, 'promemoria_pronostici',
        'Mancano 3 ore! ⏰',
        'Giornata ' || g.numero || ': manda i pronostici e ricordati di inserire la formazione.',
        '/pronostici/pronostica', 'promemoria-giornata-' || g.numero);
    end loop;
  end loop;
end;
$$;

revoke execute on function public._promemoria_pronostici() from anon, authenticated, public;

-- ---- tick: oltre alle aste, controlla anche il promemoria pronostici ----
create or replace function tick() returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select id from auctions
    where (status = 'phase1' and now() >= phase1_ends_at)
       or (status in ('phase1','phase2') and now() >= phase2_ends_at) loop
    perform _advance_auction(r.id);
  end loop;

  perform _promemoria_pronostici();
end;
$$;

revoke execute on function tick() from anon, authenticated, public;

-- Le giornate gia' chiuse (o con deadline passata) non devono generare
-- promemoria retroattivi al primo tick dopo la migrazione.
update giornate set promemoria_3h_at = now()
where chiusura_at is not null and now() >= chiusura_at - interval '3 hours';
