-- ============================================================================
-- Chiusura automatica dei pronostici a un orario prestabilito.
--
-- giornate.chiusura_at: se valorizzato, i pronostici della giornata si
-- bloccano da soli quando now() supera quell'istante. Il flag manuale
-- pronostici_chiusi resta e ha la precedenza (l'admin può chiudere prima,
-- oppure riaprire azzerando la deadline).
--
-- La logica sta in giornata_bloccata(), usata dalle policy RLS: il blocco è
-- quindi lato server, non aggirabile dal client.
-- ============================================================================

alter table giornate add column if not exists chiusura_at timestamptz;

comment on column giornate.chiusura_at is
  'Istante di chiusura automatica dei pronostici. Null = solo chiusura manuale.';

create or replace function public.giornata_bloccata(n integer)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from giornate g
    where g.numero = n
      and (g.pronostici_chiusi or (g.chiusura_at is not null and now() >= g.chiusura_at))
  )
$$;

grant execute on function public.giornata_bloccata(integer) to anon, authenticated;

-- Le policy dei pronostici passano dal flag manuale alla funzione.
drop policy if exists pronostici_select on pronostici;
create policy pronostici_select on pronostici for select
using (
  manager_id = auth.uid()
  or is_admin()
  or public.giornata_bloccata(pronostici.giornata)
);

drop policy if exists pronostici_insert_own on pronostici;
create policy pronostici_insert_own on pronostici for insert
with check (
  manager_id = auth.uid()
  and not public.giornata_bloccata(pronostici.giornata)
);

drop policy if exists pronostici_update_own on pronostici;
create policy pronostici_update_own on pronostici for update
using (
  manager_id = auth.uid()
  and not public.giornata_bloccata(pronostici.giornata)
)
with check (
  manager_id = auth.uid()
  and not public.giornata_bloccata(pronostici.giornata)
);

drop policy if exists pronostici_delete_own on pronostici;
create policy pronostici_delete_own on pronostici for delete
using (
  manager_id = auth.uid()
  and not public.giornata_bloccata(pronostici.giornata)
);

-- Giornata 1: chiusura sabato 22 agosto 2026 alle 18:30 (ora italiana).
update giornate
set chiusura_at = timestamptz '2026-08-22 18:30:00 Europe/Rome'
where numero = 1;
