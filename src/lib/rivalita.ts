// Rivalità: duelli fissi tra due squadre per tutta la stagione. Ognuno
// pronostica una volta sola chi delle due chiuderà più in alto in campionato,
// poi il duello si segue giornata per giornata e a fine anno vince chi sta
// davanti in classifica.
import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import type { Tables } from './database.types'
import { useAuth } from '../auth/AuthProvider'
import { calculateCampionatoStandings, type PartitaResult } from './tornei'

export type Rivalita = Tables<'rivalita'>
export type RivalitaVote = Tables<'rivalita_votes'>
export type RivalitaConfig = Tables<'rivalita_config'>

export interface RivalitaRiepilogoRow {
  rivalitaId: number
  votiA: number
  votiB: number
}

// ---------------- Chiusura pronostici ----------------

/**
 * I pronostici si chiudono tutti insieme alla deadline: stessa regola di
 * rivalita_chiuse() lato server, replicata qui solo per l'interfaccia.
 */
export function rivalitaChiuse(
  config: RivalitaConfig | null | undefined,
  now: number = Date.now(),
): boolean {
  if (!config?.chiusura_at) return false
  return now >= new Date(config.chiusura_at).getTime()
}

// ---------------- Query ----------------

export function useRivalita() {
  return useQuery({
    queryKey: ['rivalita'],
    queryFn: async (): Promise<Rivalita[]> => {
      const { data, error } = await supabase
        .from('rivalita')
        .select('*')
        .order('ordine')
        .order('id')
      if (error) throw error
      return data ?? []
    },
    staleTime: 60_000,
  })
}

export function useRivalitaConfig() {
  return useQuery({
    queryKey: ['rivalita_config'],
    queryFn: async (): Promise<RivalitaConfig | null> => {
      const { data, error } = await supabase.from('rivalita_config').select('*').maybeSingle()
      if (error) throw error
      return data
    },
    staleTime: 30_000,
  })
}

/** I miei pronostici, uno per rivalità. */
export function useMyRivalitaVotes() {
  const { manager } = useAuth()
  return useQuery({
    queryKey: ['rivalita_votes', 'mine', manager?.id],
    enabled: !!manager?.id,
    queryFn: async (): Promise<RivalitaVote[]> => {
      const { data, error } = await supabase
        .from('rivalita_votes')
        .select('*')
        .eq('manager_id', manager!.id)
      if (error) throw error
      return data ?? []
    },
    staleTime: 5_000,
  })
}

/**
 * Totali per duello via RPC: i voti altrui non sono leggibili (RLS). Il server
 * restituisce solo le rivalità già sbloccate (pronosticate, o a chiusura
 * avvenuta, o all'admin).
 */
export function useRivalitaRiepilogo() {
  return useQuery({
    queryKey: ['rivalita_votes', 'riepilogo'],
    queryFn: async (): Promise<RivalitaRiepilogoRow[]> => {
      const { data, error } = await supabase.rpc('rivalita_riepilogo')
      if (error) throw error
      return (data ?? []).map((r) => ({
        rivalitaId: r.rivalita_id,
        votiA: r.voti_a,
        votiB: r.voti_b,
      }))
    },
    staleTime: 5_000,
  })
}

/** Tutti i voti, solo per l'admin (RLS: gli altri vedono solo i propri). */
export function useAdminRivalitaVotes() {
  return useQuery({
    queryKey: ['rivalita_votes', 'all'],
    queryFn: async (): Promise<RivalitaVote[]> => {
      const { data, error } = await supabase.from('rivalita_votes').select('*')
      if (error) throw error
      return data ?? []
    },
    staleTime: 5_000,
  })
}

// ---------------- Mutation utente ----------------

export function useSubmitRivalitaVote() {
  const { manager } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { rivalita_id: number; scelta: string }) => {
      if (!manager) throw new Error('Non autenticato')
      const { error } = await supabase.from('rivalita_votes').upsert(
        {
          rivalita_id: input.rivalita_id,
          manager_id: manager.id,
          scelta: input.scelta,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'rivalita_id,manager_id' },
      )
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rivalita_votes'] }),
  })
}

// ---------------- Mutation admin ----------------

export function useAdminSaveRivalita() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      id?: number
      team_a: string
      team_b: string
      soprannome: string
      ordine: number
    }) => {
      if (input.team_a === input.team_b) throw new Error('Le due squadre devono essere diverse')
      const row = {
        team_a: input.team_a,
        team_b: input.team_b,
        soprannome: input.soprannome,
        ordine: input.ordine,
      }
      const { error } =
        input.id == null
          ? await supabase.from('rivalita').insert(row)
          : await supabase.from('rivalita').update(row).eq('id', input.id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rivalita'] }),
  })
}

export function useAdminDeleteRivalita() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('rivalita').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rivalita'] })
      qc.invalidateQueries({ queryKey: ['rivalita_votes'] })
    },
  })
}

export function useAdminSetRivalitaChiusura() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (chiusura_at: string | null) => {
      const { error } = await supabase
        .from('rivalita_config')
        .upsert({ id: true, chiusura_at }, { onConflict: 'id' })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rivalita_config'] })
      qc.invalidateQueries({ queryKey: ['rivalita_votes'] })
    },
  })
}

// ---------------- Andamento in classifica ----------------

export interface GiornataStanding {
  giornata: number
  /** Posizione in classifica di ogni squadra dopo questa giornata. */
  pos: Record<string, number>
  /** Punti in classifica di ogni squadra dopo questa giornata. */
  pts: Record<string, number>
}

/**
 * Classifica cumulativa dopo ogni giornata già giocata. Calcolata una volta
 * sola e riusata da tutte le rivalità: sono al massimo 38 classifiche.
 */
export function standingsPerGiornata(partite: PartitaResult[], teams: string[]): GiornataStanding[] {
  const giocate = [
    ...new Set(
      partite.filter((p) => p.gol_casa != null && p.gol_trasferta != null).map((p) => p.giornata),
    ),
  ].sort((a, b) => a - b)

  return giocate.map((giornata) => {
    const rows = calculateCampionatoStandings(
      partite.filter((p) => p.giornata <= giornata),
      teams,
    )
    const pos: Record<string, number> = {}
    const pts: Record<string, number> = {}
    for (const r of rows) {
      pos[r.team] = r.pos
      pts[r.team] = r.pts
    }
    return { giornata, pos, pts }
  })
}

export interface RivalitaAndamento {
  giornata: number
  posA: number
  posB: number
  ptsA: number
  ptsB: number
}

export interface RivalitaStato {
  /** Andamento giornata per giornata, vuoto finché non ci sono risultati. */
  andamento: RivalitaAndamento[]
  /** Squadra attualmente davanti in classifica, null se il campionato non è iniziato. */
  leader: string | null
  posA: number | null
  posB: number | null
  ptsA: number | null
  ptsB: number | null
  /** Quante posizioni di classifica separano le due squadre. */
  distacco: number | null
}

export function statoRivalita(
  standings: GiornataStanding[],
  teamA: string,
  teamB: string,
): RivalitaStato {
  const andamento = standings
    .filter((s) => s.pos[teamA] != null && s.pos[teamB] != null)
    .map((s) => ({
      giornata: s.giornata,
      posA: s.pos[teamA],
      posB: s.pos[teamB],
      ptsA: s.pts[teamA],
      ptsB: s.pts[teamB],
    }))

  const ultima = andamento[andamento.length - 1]
  if (!ultima) {
    return {
      andamento,
      leader: null,
      posA: null,
      posB: null,
      ptsA: null,
      ptsB: null,
      distacco: null,
    }
  }
  return {
    andamento,
    leader: ultima.posA < ultima.posB ? teamA : teamB,
    posA: ultima.posA,
    posB: ultima.posB,
    ptsA: ultima.ptsA,
    ptsB: ultima.ptsB,
    distacco: Math.abs(ultima.posA - ultima.posB),
  }
}

/** Il campionato è finito quando ogni giornata del calendario ha i risultati. */
export function campionatoFinito(partite: PartitaResult[]): boolean {
  if (partite.length === 0) return false
  return partite.every((p) => p.gol_casa != null && p.gol_trasferta != null)
}

// ---------------- Realtime ----------------

export function useRivalitaRealtime() {
  const qc = useQueryClient()
  useEffect(() => {
    const channel = supabase
      .channel('rivalita-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rivalita' }, () =>
        qc.invalidateQueries({ queryKey: ['rivalita'] }),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rivalita_config' }, () =>
        qc.invalidateQueries({ queryKey: ['rivalita_config'] }),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rivalita_votes' }, () =>
        qc.invalidateQueries({ queryKey: ['rivalita_votes'] }),
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [qc])
}
