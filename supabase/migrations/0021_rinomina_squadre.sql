-- ============================================================================
-- Rinomina squadre + unificazione dei nomi storici sul nome attuale.
--   Minotorino, Soh Matta             -> Minotoro
--   VILTRUM, Rocks Pirates            -> SAO SALVADOR
--   Come VaVa                         -> PASSAMO ALLE COSE FORMALI
--   Beautiful Abbyssinian             -> Frocinone
--   Lang olodelsesso                  -> Hadjuk Spanato
-- I nomi vecchi vengono riscritti anche in storico_partite e ranking_generale,
-- così scontri diretti, albo d'oro e classifica generale usano sempre il nome
-- attuale della squadra. display_name viene riallineato a team_name.
-- ============================================================================

do $$
declare t record;
begin
  for t in
    select * from (values
      ('managers','team_name'),
      ('managers','display_name'),
      ('partite','casa'),
      ('partite','trasferta'),
      ('storico_partite','casa'),
      ('storico_partite','trasferta'),
      ('albo_oro','squadra'),
      ('players','owner_team'),
      ('scambi','squadra_a'),
      ('scambi','squadra_b'),
      ('scambio_giocatori','da'),
      ('scambio_giocatori','a'),
      ('ranking_generale','team_name')
    ) as v(tbl, col)
  loop
    execute format($f$
      update public.%I set %I = m.nuovo
      from (values
        ('Minotorino','Minotoro'),
        ('Soh Matta','Minotoro'),
        ('VILTRUM','SAO SALVADOR'),
        ('Rocks Pirates','SAO SALVADOR'),
        ('Come VaVa','PASSAMO ALLE COSE FORMALI'),
        ('Come  VaVa','PASSAMO ALLE COSE FORMALI'),
        ('Beautiful Abbyssinian','Frocinone'),
        ('Lang olodelsesso','Hadjuk Spanato')
      ) as m(vecchio, nuovo)
      where public.%I.%I = m.vecchio
    $f$, t.tbl, t.col, t.tbl, t.col);
  end loop;
end $$;

-- Il nome squadra è anche il nome visualizzato.
update managers set display_name = team_name
where display_name is distinct from team_name;
