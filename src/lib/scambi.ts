import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import type { Tables } from './database.types'

export type Scambio = Tables<'scambi'>
export type ScambioGiocatore = Tables<'scambio_giocatori'>

export function useScambi() {
  return useQuery({
    queryKey: ['scambi'],
    queryFn: async (): Promise<Scambio[]> => {
      const { data, error } = await supabase.from('scambi').select('*').order('data', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    staleTime: 15_000,
  })
}

export function useScambioGiocatori() {
  return useQuery({
    queryKey: ['scambio_giocatori'],
    queryFn: async (): Promise<ScambioGiocatore[]> => {
      const { data, error } = await supabase.from('scambio_giocatori').select('*')
      if (error) throw error
      return data ?? []
    },
    staleTime: 15_000,
  })
}

export interface EseguiScambioInput {
  managerA: string
  managerB: string
  playersA: number[]
  playersB: number[]
  creditiA: number
  creditiB: number
  note?: string | null
}

export function useAdminEseguiScambio() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: EseguiScambioInput) => {
      const { error } = await supabase.rpc('esegui_scambio', {
        p_manager_a: input.managerA,
        p_manager_b: input.managerB,
        p_players_a: input.playersA,
        p_players_b: input.playersB,
        p_crediti_a: input.creditiA,
        p_crediti_b: input.creditiB,
        p_note: input.note ?? undefined,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scambi'] })
      qc.invalidateQueries({ queryKey: ['scambio_giocatori'] })
      qc.invalidateQueries({ queryKey: ['players'] })
      qc.invalidateQueries({ queryKey: ['managers'] })
      qc.invalidateQueries({ queryKey: ['credits'] })
    },
  })
}

export function useAdminDeleteScambio() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('scambi').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scambi'] })
      qc.invalidateQueries({ queryKey: ['scambio_giocatori'] })
    },
  })
}

export function useScambiRealtime() {
  const qc = useQueryClient()
  useEffect(() => {
    const channel = supabase
      .channel('scambi-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scambi' }, () =>
        qc.invalidateQueries({ queryKey: ['scambi'] }),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scambio_giocatori' }, () =>
        qc.invalidateQueries({ queryKey: ['scambio_giocatori'] }),
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [qc])
}
