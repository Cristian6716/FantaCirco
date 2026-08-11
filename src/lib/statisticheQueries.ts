import { useEffect, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import type { Tables } from './database.types'
import { useAuth } from '../auth/AuthProvider'
import { buildGiornateScores, useOverrides, usePartite, usePunteggiGiornata } from './leagueQueries'
import { useManagers } from './queries'
import { resolveTournament, type TorneoOverrideInput } from './tornei'
import { initialMatches } from './torneoData'
import { STAGIONE_CORRENTE, type StatMatch } from './statisticheCalc'

export type StoricoPartita = Tables<'storico_partite'>
export type AlboOroRow = Tables<'albo_oro'>
export type StatisticaMercato = Tables<'statistiche_mercato'>

// ---------------- Query ----------------

export function useStoricoPartite() {
  return useQuery({
    queryKey: ['storico_partite'],
    queryFn: async (): Promise<StoricoPartita[]> => {
      const { data, error } = await supabase.from('storico_partite').select('*').order('stagione').order('giornata')
      if (error) throw error
      return data ?? []
    },
    staleTime: 30_000,
  })
}

export function useAlboOro() {
  return useQuery({
    queryKey: ['albo_oro'],
    queryFn: async (): Promise<AlboOroRow[]> => {
      const { data, error } = await supabase.from('albo_oro').select('*').order('stagione', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    staleTime: 30_000,
  })
}

export function useStatisticheMercato() {
  return useQuery({
    queryKey: ['statistiche_mercato'],
    queryFn: async (): Promise<StatisticaMercato[]> => {
      const { data, error } = await supabase
        .from('statistiche_mercato')
        .select('*')
        .order('data', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    staleTime: 15_000,
  })
}

// ---------------- Mutation admin ----------------

export function useAdminAddStoricoPartite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (
      rows: {
        stagione: string
        giornata: number
        casa: string
        trasferta: string
        gol_casa: number
        gol_trasferta: number
        punti_casa?: number | null
        punti_trasferta?: number | null
      }[],
    ) => {
      const { error } = await supabase.from('storico_partite').insert(rows)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['storico_partite'] }),
  })
}

export function useAdminDeleteStoricoPartita() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('storico_partite').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['storico_partite'] }),
  })
}

export function useAdminDeleteStoricoStagione() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (stagione: string) => {
      const { error } = await supabase.from('storico_partite').delete().eq('stagione', stagione)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['storico_partite'] }),
  })
}

export function useAdminAddAlboOro() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { stagione: string; competizione: string; squadra: string; note?: string | null }) => {
      const { error } = await supabase.from('albo_oro').insert(input)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['albo_oro'] }),
  })
}

export function useAdminDeleteAlboOro() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('albo_oro').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['albo_oro'] }),
  })
}

export function useAdminAddStatisticaMercato() {
  const { manager } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { titolo: string; testo: string; data?: string | null }) => {
      const { error } = await supabase
        .from('statistiche_mercato')
        .insert({ titolo: input.titolo, testo: input.testo, data: input.data ?? null, created_by: manager?.id })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['statistiche_mercato'] }),
  })
}

export function useAdminUpdateStatisticaMercato() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: number; titolo: string; testo: string; data?: string | null }) => {
      const { error } = await supabase
        .from('statistiche_mercato')
        .update({ titolo: input.titolo, testo: input.testo, data: input.data ?? null })
        .eq('id', input.id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['statistiche_mercato'] }),
  })
}

export function useAdminDeleteStatisticaMercato() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('statistiche_mercato').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['statistiche_mercato'] }),
  })
}

// ---------------- Realtime ----------------

export function useStatisticheRealtime() {
  const qc = useQueryClient()
  useEffect(() => {
    const channel = supabase
      .channel('statistiche-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'storico_partite' }, () =>
        qc.invalidateQueries({ queryKey: ['storico_partite'] }),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'albo_oro' }, () =>
        qc.invalidateQueries({ queryKey: ['albo_oro'] }),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'statistiche_mercato' }, () =>
        qc.invalidateQueries({ queryKey: ['statistiche_mercato'] }),
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [qc])
}

// ---------------- Partite unificate (campionato corrente + storico + Coppa) ----------------

/** Costruisce l'elenco unificato di StatMatch usato da record, albo d'oro e H2H. */
export function useStatMatches() {
  const { data: partite } = usePartite()
  const { data: storico } = useStoricoPartite()
  const { data: managers } = useManagers()
  const { data: punteggi } = usePunteggiGiornata()
  const { data: overrides } = useOverrides()

  return useMemo((): StatMatch[] => {
    const out: StatMatch[] = []
    const scores = managers && punteggi ? buildGiornateScores(punteggi, managers) : {}

    for (const p of partite ?? []) {
      if (p.gol_casa == null || p.gol_trasferta == null) continue
      const giornataScores = scores[String(p.giornata)]
      out.push({
        stagione: STAGIONE_CORRENTE,
        competizione: 'campionato',
        giornata: p.giornata,
        casa: p.casa,
        trasferta: p.trasferta,
        golCasa: p.gol_casa,
        golTrasferta: p.gol_trasferta,
        puntiCasa: giornataScores?.[p.casa] ?? null,
        puntiTrasferta: giornataScores?.[p.trasferta] ?? null,
      })
    }

    for (const s of storico ?? []) {
      out.push({
        stagione: s.stagione,
        competizione: 'campionato',
        giornata: s.giornata,
        casa: s.casa,
        trasferta: s.trasferta,
        golCasa: s.gol_casa,
        golTrasferta: s.gol_trasferta,
        puntiCasa: s.punti_casa != null ? Number(s.punti_casa) : null,
        puntiTrasferta: s.punti_trasferta != null ? Number(s.punti_trasferta) : null,
      })
    }

    if (managers && punteggi) {
      const ovr: Record<string, TorneoOverrideInput> = {}
      for (const o of overrides ?? []) ovr[o.match_id] = { winner: o.winner as 'A' | 'B', golA: o.gol_a, golB: o.gol_b }
      const resolved = resolveTournament(initialMatches, scores, ovr)
      for (const m of resolved) {
        if (m.golA == null || m.golB == null) continue
        if (m.teamA.startsWith('Vinc.') || m.teamA.startsWith('Perd.')) continue
        if (m.teamB.startsWith('Vinc.') || m.teamB.startsWith('Perd.')) continue
        out.push({
          stagione: STAGIONE_CORRENTE,
          competizione: 'coppa',
          giornata: m.day,
          casa: m.teamA,
          trasferta: m.teamB,
          golCasa: m.golA,
          golTrasferta: m.golB,
          puntiCasa: null,
          puntiTrasferta: null,
        })
      }
    }

    return out
  }, [partite, storico, managers, punteggi, overrides])
}
