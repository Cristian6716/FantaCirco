import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import { useAuth } from '../auth/AuthProvider'
import type { Tables } from './database.types'

export type RankingRow = Tables<'ranking_generale'>

/** Ranking generale (Campionato + Battle Royale + Torneo dello scorso anno), ordinato per posizione. */
export function useRanking() {
  return useQuery({
    queryKey: ['ranking_generale'],
    queryFn: async (): Promise<RankingRow[]> => {
      const { data, error } = await supabase.from('ranking_generale').select('*').order('pos')
      if (error) throw error
      return data ?? []
    },
    staleTime: 60_000,
  })
}

/** Riga di ranking della squadra dell'utente corrente (null se non presente, es. giocatore nuovo). */
export function useMyRanking() {
  const { manager } = useAuth()
  const { data } = useRanking()
  if (!manager || !data) return null
  return data.find((r) => r.manager_id === manager.id) ?? null
}

export function useRankingRealtime() {
  const qc = useQueryClient()
  useEffect(() => {
    const channel = supabase
      .channel('ranking-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ranking_generale' }, () =>
        qc.invalidateQueries({ queryKey: ['ranking_generale'] }),
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [qc])
}
