import { supabase } from './supabase'

// ---- RPC giocatori ----
export async function startAuction(
  playerId: number,
  base: number,
  phase1Minutes?: number,
  phase2Minutes?: number,
): Promise<number> {
  const { data, error } = await supabase.rpc('start_auction', {
    p_player: playerId,
    p_base: base,
    ...(phase1Minutes != null ? { p_phase1_minutes: phase1Minutes } : {}),
    ...(phase2Minutes != null ? { p_phase2_minutes: phase2Minutes } : {}),
  })
  if (error) throw new Error(error.message)
  return (data as number) ?? 0
}

export async function placeBid(auctionId: number, amount: number): Promise<void> {
  const { error } = await supabase.rpc('place_bid', { p_auction: auctionId, p_amount: amount })
  if (error) throw new Error(error.message)
}

export async function setAutobid(auctionId: number, max: number): Promise<void> {
  const { error } = await supabase.rpc('set_autobid', { p_auction: auctionId, p_max: max })
  if (error) throw new Error(error.message)
}

export async function cancelAutobid(auctionId: number): Promise<void> {
  const { error } = await supabase.rpc('cancel_autobid', { p_auction: auctionId })
  if (error) throw new Error(error.message)
}

export async function withdraw(auctionId: number): Promise<void> {
  const { error } = await supabase.rpc('withdraw', { p_auction: auctionId })
  if (error) throw new Error(error.message)
}

// ---- RPC admin ----
export async function adminPause(auctionId: number): Promise<void> {
  const { error } = await supabase.rpc('admin_pause_auction', { p_auction: auctionId })
  if (error) throw new Error(error.message)
}
export async function adminResume(auctionId: number): Promise<void> {
  const { error } = await supabase.rpc('admin_resume_auction', { p_auction: auctionId })
  if (error) throw new Error(error.message)
}
export async function adminCancel(auctionId: number): Promise<void> {
  const { error } = await supabase.rpc('admin_cancel_auction', { p_auction: auctionId })
  if (error) throw new Error(error.message)
}
export async function adminDelete(auctionId: number): Promise<void> {
  const { error } = await supabase.rpc('admin_delete_auction', { p_auction: auctionId })
  if (error) throw new Error(error.message)
}
export async function adminDeleteAll(): Promise<void> {
  const { error } = await supabase.rpc('admin_delete_all_auctions')
  if (error) throw new Error(error.message)
}

// ---- Gestione giocatori (admin, scrittura diretta protetta da RLS) ----
export interface NewPlayer {
  name: string
  real_team?: string | null
  roles?: string[]
}

export async function importPlayers(players: NewPlayer[]): Promise<number> {
  const rows = players.map((p) => ({
    name: p.name,
    real_team: p.real_team ?? null,
    roles: p.roles ?? [],
  }))
  const { error, count } = await supabase
    .from('players')
    .insert(rows, { count: 'exact' })
  if (error) throw new Error(error.message)
  return count ?? rows.length
}

export async function deletePlayer(id: number): Promise<void> {
  const { error } = await supabase.from('players').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function updateManagerCredits(id: string, credits: number): Promise<void> {
  const { error } = await supabase.from('managers').update({ credits_total: credits }).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function updateManager(
  id: string,
  patch: { display_name?: string; team_name?: string | null; is_admin?: boolean },
): Promise<void> {
  const { error } = await supabase.from('managers').update(patch).eq('id', id)
  if (error) throw new Error(error.message)
}

// ---- Creazione account via Edge Function (admin) ----
export interface NewManager {
  username: string
  display_name: string
  team_name?: string
  credits?: number
  password: string
  is_admin?: boolean
}

export async function createManager(input: NewManager): Promise<void> {
  const { data, error } = await supabase.functions.invoke('admin-create-user', {
    body: input,
  })
  if (error) {
    // L'errore della function arriva spesso nel body
    const msg = (data as { error?: string } | null)?.error
    throw new Error(msg || error.message)
  }
  if (data && (data as { error?: string }).error) {
    throw new Error((data as { error: string }).error)
  }
}

export async function changeMyPassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw new Error(error.message)
}
