-- ============================================================================
-- Passaggio da account di prova (email sintetiche) a registrazione reale.
-- Applicata su Supabase come migrazione `self_signup`.
-- ============================================================================

-- 0) Scollega il calendario dai vecchi account: casa_manager/trasferta_manager
--    verranno ripopolati automaticamente (per nome squadra) da claim_team.
update partite set casa_manager = null, trasferta_manager = null;

-- 1) Pulizia degli account di prova (16 squadre + 1 admin), nessun dato di
--    gioco reale collegato (verificato: aste/bid/autobid/partecipazioni/push = 0).
delete from auth.users where email like '%@fanta.local';

-- 2) Una squadra puo' essere reclamata da un solo manager.
create unique index if not exists managers_team_name_unique
  on managers(team_name) where team_name is not null;

-- 3) Provisioning automatico: ogni nuovo utente Supabase Auth ottiene una riga
--    managers (senza squadra). L'email indicata diventa admin in automatico.
create or replace function handle_new_manager() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.managers (id, username, display_name, is_admin, credits_total)
  values (
    new.id,
    new.email,
    split_part(new.email, '@', 1),
    lower(new.email) = 'cristian6716@gmail.com',
    500
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_manager();

-- 4) Scelta squadra, una tantum: bypassa la RLS restrittiva su managers
--    (che oggi consente scritture solo agli admin) tramite security definer.
--    Ricollega anche il calendario partite alla nuova identità, per nome squadra.
create or replace function claim_team(p_team_name text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_current text;
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
exception
  when unique_violation then
    raise exception 'Questa squadra è già stata scelta da qualcun altro.';
end;
$$;
revoke all on function claim_team(text) from public;
grant execute on function claim_team(text) to authenticated;
