-- ============================================================================
-- Chiusura automatica della votazione podio, stessa logica delle giornate.
--
-- podio_rounds.chiusura_at: se valorizzato, il round si chiude da solo quando
-- now() lo supera. Lo status 'closed' resta e ha la precedenza (l'admin può
-- chiudere prima).
--
-- A round chiuso la classifica aggregata diventa visibile a tutti, anche a chi
-- non ha votato: è quello che alimenta la grafica del podio finale.
-- ============================================================================

alter table podio_rounds add column if not exists chiusura_at timestamptz;

comment on column podio_rounds.chiusura_at is
  'Istante di chiusura automatica del round. Null = solo chiusura manuale.';

create or replace function public.podio_round_chiuso(p_round int)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from podio_rounds r
    where r.id = p_round
      and (r.status = 'closed' or (r.chiusura_at is not null and now() >= r.chiusura_at))
  )
$$;

grant execute on function public.podio_round_chiuso(integer) to authenticated;

-- Voti: si può votare/modificare solo finché il round non è chiuso.
drop policy if exists podio_votes_insert_own on podio_votes;
create policy podio_votes_insert_own on podio_votes for insert to authenticated
with check (
  manager_id = auth.uid()
  and not public.podio_round_chiuso(podio_votes.round_id)
);

drop policy if exists podio_votes_update_own on podio_votes;
create policy podio_votes_update_own on podio_votes for update to authenticated
using (
  manager_id = auth.uid()
  and not public.podio_round_chiuso(podio_votes.round_id)
)
with check (
  manager_id = auth.uid()
  and not public.podio_round_chiuso(podio_votes.round_id)
);

-- La classifica si sblocca a round chiuso (anche per chiusura automatica).
create or replace function podio_classifica(p_round int)
returns table (manager_id uuid, nome text, c1 int, c2 int, c3 int, cu int, punti int)
language sql stable security definer set search_path = public as $$
  select
    m.id,
    coalesce(m.team_name, m.display_name) as nome,
    c.c1,
    c.c2,
    c.c3,
    c.cu,
    (c.c1 * 3 + c.c2 * 2 + c.c3) as punti
  from managers m
  cross join lateral (
    select
      (count(*) filter (where v.pos1 = m.id))::int as c1,
      (count(*) filter (where v.pos2 = m.id))::int as c2,
      (count(*) filter (where v.pos3 = m.id))::int as c3,
      (count(*) filter (where v.ultimo = m.id))::int as cu
    from podio_votes v
    where v.round_id = p_round
  ) c
  where m.team_name is not null
    and (
      is_admin()
      or public.podio_round_chiuso(p_round)
      or exists (
        select 1 from podio_votes mv
        where mv.round_id = p_round and mv.manager_id = auth.uid()
      )
    )
  order by punti desc, c.c1 desc, nome;
$$;

revoke all on function podio_classifica(int) from public, anon;
grant execute on function podio_classifica(int) to authenticated;

-- Votazione in corso: chiusura sabato 22 agosto 2026 alle 18:30 (ora italiana),
-- in contemporanea con i pronostici della prima giornata.
update podio_rounds
set chiusura_at = timestamptz '2026-08-22 18:30:00 Europe/Rome'
where status = 'open';
