// Votazione podio: l'admin apre un round, i manager votano 1°/2°/3° e ultimo tra le squadre.
import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import type { Tables } from './database.types'
import { useAuth } from '../auth/AuthProvider'
import type { Manager } from './queries'

export type PodioRound = Tables<'podio_rounds'>
export type PodioVote = Tables<'podio_votes'>

// ---------------- Query ----------------

export function usePodioRounds() {
  return useQuery({
    queryKey: ['podio_rounds'],
    queryFn: async (): Promise<PodioRound[]> => {
      const { data, error } = await supabase
        .from('podio_rounds')
        .select('*')
        .order('numero', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    staleTime: 10_000,
  })
}

export function useOpenPodioRound(): PodioRound | undefined {
  const { data } = usePodioRounds()
  return data?.find((r) => r.status === 'open')
}

export function useMyPodioVote(roundId: number | undefined) {
  const { manager } = useAuth()
  return useQuery({
    queryKey: ['podio_votes', 'mine', roundId, manager?.id],
    enabled: roundId != null && !!manager?.id,
    queryFn: async (): Promise<PodioVote | null> => {
      const { data, error } = await supabase
        .from('podio_votes')
        .select('*')
        .eq('round_id', roundId!)
        .eq('manager_id', manager!.id)
        .maybeSingle()
      if (error) throw error
      return data
    },
    staleTime: 5_000,
  })
}

export function useAdminPodioVotes(roundId: number | undefined) {
  return useQuery({
    queryKey: ['podio_votes', 'round', roundId],
    enabled: roundId != null,
    queryFn: async (): Promise<PodioVote[]> => {
      const { data, error } = await supabase
        .from('podio_votes')
        .select('*')
        .eq('round_id', roundId!)
      if (error) throw error
      return data ?? []
    },
    staleTime: 5_000,
  })
}

// Classifica aggregata via RPC: i voti altrui non sono leggibili (RLS), quindi
// il totale arriva dal server. Ritorna righe solo a chi ha già votato il round
// (o a round chiuso / admin), altrimenti lista vuota.
export function usePodioClassifica(roundId: number | undefined, enabled = true) {
  return useQuery({
    queryKey: ['podio_votes', 'classifica', roundId],
    enabled: roundId != null && enabled,
    queryFn: async (): Promise<PodioClassificaRow[]> => {
      const { data, error } = await supabase.rpc('podio_classifica', { p_round: roundId! })
      if (error) throw error
      return (data ?? []).map((r) => ({
        managerId: r.manager_id,
        nome: r.nome,
        punti: r.punti,
        c1: r.c1,
        c2: r.c2,
        c3: r.c3,
        cu: r.cu,
      }))
    },
    staleTime: 5_000,
    refetchInterval: 30_000,
  })
}

// ---------------- Mutation utente ----------------

export function useSubmitPodioVote() {
  const { manager } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      round_id: number
      pos1: string
      pos2: string
      pos3: string
      ultimo: string | null
    }) => {
      if (!manager) throw new Error('Non autenticato')
      const { error } = await supabase.from('podio_votes').upsert(
        {
          round_id: input.round_id,
          manager_id: manager.id,
          pos1: input.pos1,
          pos2: input.pos2,
          pos3: input.pos3,
          ultimo: input.ultimo,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'round_id,manager_id' },
      )
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['podio_votes'] }),
  })
}

// ---------------- Mutation admin ----------------

export function useAdminStartPodioRound() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data: existing, error: fetchErr } = await supabase
        .from('podio_rounds')
        .select('numero, status')
        .order('numero', { ascending: false })
      if (fetchErr) throw new Error(fetchErr.message)

      const openIds = (existing ?? []).filter((r) => r.status === 'open')
      if (openIds.length > 0) {
        const { error: closeErr } = await supabase
          .from('podio_rounds')
          .update({ status: 'closed', closed_at: new Date().toISOString() })
          .eq('status', 'open')
        if (closeErr) throw new Error(closeErr.message)
      }

      const nextNumero = (existing ?? []).reduce((max, r) => Math.max(max, r.numero), 0) + 1
      const { error: insertErr } = await supabase
        .from('podio_rounds')
        .insert({ numero: nextNumero, status: 'open' })
      if (insertErr) throw new Error(insertErr.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['podio_rounds'] }),
  })
}

export function useAdminClosePodioRound() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (roundId: number) => {
      const { error } = await supabase
        .from('podio_rounds')
        .update({ status: 'closed', closed_at: new Date().toISOString() })
        .eq('id', roundId)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['podio_rounds'] }),
  })
}

// ---------------- Classifica podio (calcolo lato client) ----------------

export interface PodioClassificaRow {
  managerId: string
  nome: string
  punti: number
  c1: number
  c2: number
  c3: number
  cu: number
}

export function computePodioClassifica(votes: PodioVote[], managers: Manager[]): PodioClassificaRow[] {
  const rows = new Map<string, PodioClassificaRow>()
  for (const m of managers) {
    if (!m.team_name) continue
    rows.set(m.id, { managerId: m.id, nome: m.team_name || m.display_name, punti: 0, c1: 0, c2: 0, c3: 0, cu: 0 })
  }
  for (const v of votes) {
    const r1 = rows.get(v.pos1)
    if (r1) {
      r1.punti += 3
      r1.c1 += 1
    }
    const r2 = rows.get(v.pos2)
    if (r2) {
      r2.punti += 2
      r2.c2 += 1
    }
    const r3 = rows.get(v.pos3)
    if (r3) {
      r3.punti += 1
      r3.c3 += 1
    }
    const ru = v.ultimo ? rows.get(v.ultimo) : undefined
    if (ru) ru.cu += 1
  }
  return Array.from(rows.values()).sort((a, b) => b.punti - a.punti || b.c1 - a.c1)
}

// ---------------- Realtime ----------------

export function usePodioRealtime() {
  const qc = useQueryClient()
  useEffect(() => {
    const channel = supabase
      .channel('podio-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'podio_rounds' }, () =>
        qc.invalidateQueries({ queryKey: ['podio_rounds'] }),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'podio_votes' }, () =>
        qc.invalidateQueries({ queryKey: ['podio_votes'] }),
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [qc])
}
