-- ============================================================================
-- Pronostico dell'ultimo classificato, accanto ai primi tre.
-- La colonna è nullable: i voti già espressi restano validi (ultimo = null)
-- finché il manager non modifica il proprio voto.
-- ============================================================================

alter table podio_votes add column if not exists ultimo uuid references managers(id);

alter table podio_votes drop constraint if exists podio_votes_ultimo_distinct;
alter table podio_votes add constraint podio_votes_ultimo_distinct
  check (ultimo is null or (ultimo <> pos1 and ultimo <> pos2 and ultimo <> pos3));

-- La classifica aggregata aggiunge il conteggio "ultimo" (cu). I punti restano
-- quelli del podio (3/2/1): l'ultimo posto è un pronostico a sé.
drop function if exists podio_classifica(int);

create function podio_classifica(p_round int)
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
