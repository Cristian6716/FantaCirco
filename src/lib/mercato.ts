import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import type { Tables } from './database.types'

export type MercatoAnnuncio = Tables<'mercato_annunci'>
export type Preferenza = 'quantita' | 'qualita'

export function useMercato() {
  return useQuery({
    queryKey: ['mercato'],
    queryFn: async (): Promise<MercatoAnnuncio[]> => {
      const { data, error } = await supabase
        .from('mercato_annunci')
        .select('*')
        .order('updated_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    staleTime: 15_000,
  })
}

export interface AnnuncioInput {
  playerId: number
  managerId: string
  ruoli: string[]
  preferenza: Preferenza | null
  accettaCrediti: boolean
  /** Cifra minima richiesta; null se non specificata o se i crediti non sono accettati. */
  creditiMin: number | null
  nota: string | null
}

/** Crea o aggiorna la vetrina di un giocatore: un annuncio per giocatore. */
export function useSalvaAnnuncio() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: AnnuncioInput) => {
      const { error } = await supabase.from('mercato_annunci').upsert(
        {
          player_id: input.playerId,
          manager_id: input.managerId,
          ruoli: input.ruoli,
          preferenza: input.preferenza,
          accetta_crediti: input.accettaCrediti,
          crediti_min: input.accettaCrediti ? input.creditiMin : null,
          nota: input.nota,
        },
        { onConflict: 'player_id' },
      )
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mercato'] }),
  })
}

export function useEliminaAnnuncio() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('mercato_annunci').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mercato'] }),
  })
}

export function useMercatoRealtime() {
  const qc = useQueryClient()
  useEffect(() => {
    const channel = supabase
      .channel('mercato-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mercato_annunci' }, () =>
        qc.invalidateQueries({ queryKey: ['mercato'] }),
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [qc])
}
