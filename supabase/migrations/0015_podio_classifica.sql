-- ============================================================================
-- Classifica podio visibile agli utenti.
-- I voti restano ciechi (RLS: ognuno legge solo il proprio), quindi la
-- classifica aggregata passa da una funzione security definer che espone solo
-- i totali per squadra — mai chi ha votato cosa.
-- Visibile a chi ha già votato quel round, a round chiuso, o all'admin.
-- ============================================================================

create or replace function podio_classifica(p_round int)
returns table (manager_id uuid, nome text, c1 int, c2 int, c3 int, punti int)
language sql stable security definer set search_path = public as $$
  select
    m.id,
    coalesce(m.team_name, m.display_name) as nome,
    c.c1,
    c.c2,
    c.c3,
    (c.c1 * 3 + c.c2 * 2 + c.c3) as punti
  from managers m
  cross join lateral (
    select
      (count(*) filter (where v.pos1 = m.id))::int as c1,
      (count(*) filter (where v.pos2 = m.id))::int as c2,
      (count(*) filter (where v.pos3 = m.id))::int as c3
    from podio_votes v
    where v.round_id = p_round
  ) c
  where m.team_name is not null
    and (
      is_admin()
      or exists (
        select 1 from podio_votes mv
        where mv.round_id = p_round and mv.manager_id = auth.uid()
      )
      or exists (
        select 1 from podio_rounds r
        where r.id = p_round and r.status = 'closed'
      )
    )
  order by punti desc, c.c1 desc, nome;
$$;

revoke all on function podio_classifica(int) from public, anon;
grant execute on function podio_classifica(int) to authenticated;
