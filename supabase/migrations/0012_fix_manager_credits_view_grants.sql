-- ============================================================================
-- Fix: v_manager_credits e' security_invoker, quindi le funzioni che chiama
-- direttamente girano con i permessi di chi legge. Dopo la 0010/0011 erano
-- revocate ad authenticated: la select falliva e il frontend mostrava crediti
-- e slot a zero. committed_credits resta privata (la chiama locked_credits,
-- che e' security definer).
-- ============================================================================

grant execute on function locked_credits(uuid) to authenticated;
grant execute on function roster_committed(uuid, bigint) to authenticated;
