import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import type { Tables } from './database.types'
import { useAuth } from '../auth/AuthProvider'
import type { GiornateScores } from './tornei'

export type Giornata = Tables<'giornate'>
export type Partita = Tables<'partite'>
export type Pronostico = Tables<'pronostici'>
export type PunteggioGiornata = Tables<'punteggi_giornata'>
export type TorneoOverride = Tables<'torneo_overrides'>

// ---------------- Chiusura pronostici ----------------

/**
 * Una giornata è chiusa se l'admin l'ha chiusa a mano oppure se è passata la
 * deadline di chiusura automatica. Stessa regola applicata dalle policy RLS
 * (giornata_bloccata), qui replicata solo per l'interfaccia.
 */
export function giornataChiusa(g: Giornata | null | undefined, now: number = Date.now()): boolean {
  if (!g) return false
  if (g.pronostici_chiusi) return true
  return g.chiusura_at != null && now >= new Date(g.chiusura_at).getTime()
}

/**
 * Tiene aggiornata l'ora corrente mentre manca poco alla deadline, così il
 * form si blocca da solo allo scoccare dell'orario senza ricaricare la pagina.
 */
export function useOraCorrente(deadline: string | null | undefined): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!deadline) return
    const target = new Date(deadline).getTime()
    if (!Number.isFinite(target)) return
    // Niente timer se la deadline è già passata o è a più di un giorno:
    // il valore calcolato al mount basta e avanza.
    const restante = target - Date.now()
    if (restante <= 0 || restante > 86_400_000) return
    const id = setInterval(() => {
      setNow(Date.now())
      if (Date.now() >= target) clearInterval(id)
    }, 1_000)
    return () => clearInterval(id)
  }, [deadline])
  return now
}

// ---------------- Query ----------------

export function useGiornate() {
  return useQuery({
    queryKey: ['giornate'],
    queryFn: async (): Promise<Giornata[]> => {
      const { data, error } = await supabase.from('giornate').select('*').order('numero')
      if (error) throw error
      return data ?? []
    },
    staleTime: 30_000,
  })
}

export function usePartite() {
  return useQuery({
    queryKey: ['partite'],
    queryFn: async (): Promise<Partita[]> => {
      const { data, error } = await supabase
        .from('partite')
        .select('*')
        .order('giornata')
        .order('ordine')
      if (error) throw error
      return data ?? []
    },
    staleTime: 15_000,
  })
}

/** Pronostici visibili all'utente (RLS: i propri sempre, gli altrui a giornata chiusa). */
export function usePronostici() {
  return useQuery({
    queryKey: ['pronostici'],
    queryFn: async (): Promise<Pronostico[]> => {
      const { data, error } = await supabase.from('pronostici').select('*')
      if (error) throw error
      return data ?? []
    },
    staleTime: 10_000,
  })
}

export function usePunteggiGiornata() {
  return useQuery({
    queryKey: ['punteggi_giornata'],
    queryFn: async (): Promise<PunteggioGiornata[]> => {
      const { data, error } = await supabase.from('punteggi_giornata').select('*')
      if (error) throw error
      return data ?? []
    },
    staleTime: 15_000,
  })
}

export function useOverrides() {
  return useQuery({
    queryKey: ['torneo_overrides'],
    queryFn: async (): Promise<TorneoOverride[]> => {
      const { data, error } = await supabase.from('torneo_overrides').select('*')
      if (error) throw error
      return data ?? []
    },
    staleTime: 15_000,
  })
}

// ---------------- Helper tornei ----------------

/** Costruisce la mappa { [giornata]: { [team_name]: punteggio } } per la logica tornei. */
export function buildGiornateScores(
  punteggi: PunteggioGiornata[],
  managers: { id: string; team_name: string | null }[],
): GiornateScores {
  const teamById = new Map(managers.map((m) => [m.id, m.team_name ?? '']))
  const out: GiornateScores = {}
  for (const p of punteggi) {
    const team = teamById.get(p.manager_id)
    if (!team) continue
    const key = String(p.giornata)
    if (!out[key]) out[key] = {}
    out[key][team] = Number(p.punteggio)
  }
  return out
}

// ---------------- Mutation utente ----------------

export interface PronosticoInput {
  partita_id: string
  giornata: number
  pronostico_1x2: string
  pronostico_ou: string
}

export function useSavePronostici() {
  const { manager } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (items: PronosticoInput[]) => {
      if (!manager) throw new Error('Non autenticato')
      const rows = items.map((it) => ({
        manager_id: manager.id,
        partita_id: it.partita_id,
        giornata: it.giornata,
        pronostico_1x2: it.pronostico_1x2,
        pronostico_ou: it.pronostico_ou,
        updated_at: new Date().toISOString(),
      }))
      const { error } = await supabase
        .from('pronostici')
        .upsert(rows, { onConflict: 'manager_id,partita_id' })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pronostici'] }),
  })
}

// ---------------- Mutation admin ----------------

export function useAdminSetRisultato() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      partita_id: string
      gol_casa: number | null
      gol_trasferta: number | null
    }) => {
      const { error } = await supabase
        .from('partite')
        .update({ gol_casa: input.gol_casa, gol_trasferta: input.gol_trasferta })
        .eq('id', input.partita_id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['partite'] }),
  })
}

export function useAdminSetPunteggio() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { giornata: number; manager_id: string; punteggio: number | null }) => {
      if (input.punteggio === null) {
        const { error } = await supabase
          .from('punteggi_giornata')
          .delete()
          .eq('giornata', input.giornata)
          .eq('manager_id', input.manager_id)
        if (error) throw new Error(error.message)
        return
      }
      const { error } = await supabase
        .from('punteggi_giornata')
        .upsert(
          { giornata: input.giornata, manager_id: input.manager_id, punteggio: input.punteggio },
          { onConflict: 'giornata,manager_id' },
        )
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['punteggi_giornata'] }),
  })
}

export function useAdminToggleGiornata() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { numero: number; chiusa: boolean }) => {
      const { error } = await supabase
        .from('giornate')
        .update({ pronostici_chiusi: input.chiusa })
        .eq('numero', input.numero)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['giornate'] })
      qc.invalidateQueries({ queryKey: ['pronostici'] })
    },
  })
}

export function useAdminSetChiusuraAt() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { numero: number; chiusura_at: string | null }) => {
      const { error } = await supabase
        .from('giornate')
        .update({ chiusura_at: input.chiusura_at })
        .eq('numero', input.numero)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['giornate'] })
      qc.invalidateQueries({ queryKey: ['pronostici'] })
    },
  })
}

export function useAdminSetOverride() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { match_id: string; winner: 'A' | 'B' | null }) => {
      if (input.winner === null) {
        const { error } = await supabase.from('torneo_overrides').delete().eq('match_id', input.match_id)
        if (error) throw new Error(error.message)
        return
      }
      const { error } = await supabase
        .from('torneo_overrides')
        .upsert({ match_id: input.match_id, winner: input.winner }, { onConflict: 'match_id' })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['torneo_overrides'] }),
  })
}

/** Realtime per le tabelle di pronostici e tornei. */
export function useLeagueRealtime() {
  const qc = useQueryClient()
  useEffect(() => {
    const channel = supabase
      .channel('league-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'partite' }, () =>
        qc.invalidateQueries({ queryKey: ['partite'] }),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pronostici' }, () =>
        qc.invalidateQueries({ queryKey: ['pronostici'] }),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'punteggi_giornata' }, () =>
        qc.invalidateQueries({ queryKey: ['punteggi_giornata'] }),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'torneo_overrides' }, () =>
        qc.invalidateQueries({ queryKey: ['torneo_overrides'] }),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'giornate' }, () =>
        qc.invalidateQueries({ queryKey: ['giornate'] }),
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [qc])
}
