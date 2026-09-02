-- ============================================================================
-- Mercato — la bacheca degli scambi.
--
-- Ogni fantallenatore mette in vetrina i giocatori della propria rosa che è
-- disposto a cedere e dichiara cosa vuole in cambio: quali ruoli gli servono,
-- se cerca quantità o qualità, se accetta crediti (con eventuale cifra minima)
-- e una nota libera.
--
-- È solo una bacheca: lo scambio vero resta quello dell'admin (0018), che
-- sposta giocatori e crediti in modo atomico. Qui non si muove nulla.
--
-- Un annuncio vale finché il giocatore resta nella rosa di chi l'ha
-- pubblicato: svincolo (0016), scambio (0018) o nuova stagione (0014) lo
-- fanno decadere da solo, via trigger su `players`.
-- ============================================================================

create table if not exists mercato_annunci (
  id bigint generated always as identity primary key,
  player_id bigint not null unique references players(id) on delete cascade,
  manager_id uuid not null references managers(id) on delete cascade,
  -- Codici ruolo Mantra richiesti in cambio (vuoto = qualsiasi ruolo).
  ruoli text[] not null default '{}',
  -- 'quantita' = più giocatori medi, 'qualita' = un top player, null = indifferente.
  preferenza text check (preferenza in ('quantita', 'qualita')),
  accetta_crediti boolean not null default false,
  crediti_min int check (crediti_min is null or crediti_min >= 0),
  nota text check (nota is null or char_length(nota) <= 280),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mercato_ruoli_validi check (
    ruoli <@ array['Por','Dd','Ds','Dc','B','E','M','C','W','T','A','Pc']::text[]
  ),
  -- Una cifra minima ha senso solo se i crediti sono accettati.
  constraint mercato_crediti_min_coerente check (accetta_crediti or crediti_min is null)
);
create index if not exists mercato_annunci_manager_idx on mercato_annunci(manager_id);

create or replace function public.mercato_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists mercato_annunci_touch on mercato_annunci;
create trigger mercato_annunci_touch
  before update on mercato_annunci
  for each row execute function public.mercato_touch();

-- Il giocatore cambia rosa (o esce da tutte): l'annuncio non ha più senso.
create or replace function public.mercato_pulisci_annunci()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status <> 'assigned' or new.assigned_to is distinct from old.assigned_to then
    delete from mercato_annunci
      where player_id = new.id
        and (new.status <> 'assigned' or manager_id is distinct from new.assigned_to);
  end if;
  return new;
end;
$$;

drop trigger if exists players_mercato_pulizia on players;
create trigger players_mercato_pulizia
  after update of status, assigned_to on players
  for each row execute function public.mercato_pulisci_annunci();

alter table mercato_annunci enable row level security;

create policy mercato_annunci_select on mercato_annunci
  for select to authenticated using (true);

-- Si può mettere in vetrina solo un giocatore della propria rosa.
create policy mercato_annunci_insert on mercato_annunci
  for insert to authenticated with check (
    manager_id = auth.uid()
    and exists (
      select 1 from players p
      where p.id = player_id and p.status = 'assigned' and p.assigned_to = auth.uid()
    )
  );

create policy mercato_annunci_update on mercato_annunci
  for update to authenticated
  using (manager_id = auth.uid() or is_admin())
  with check (manager_id = auth.uid() or is_admin());

create policy mercato_annunci_delete on mercato_annunci
  for delete to authenticated using (manager_id = auth.uid() or is_admin());

alter publication supabase_realtime add table mercato_annunci;
