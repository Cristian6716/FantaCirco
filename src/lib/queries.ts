import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import type { Tables } from './database.types'
import { useAuth } from '../auth/AuthProvider'

export type Manager = Tables<'managers'>
export type Player = Tables<'players'>
export type Auction = Tables<'auctions'>
export type Bid = Tables<'bids'>
export type Participant = Tables<'auction_participants'>
export type Autobid = Tables<'autobids'>
export type ManagerCredits = Tables<'v_manager_credits'>

export function useManagers() {
  return useQuery({
    queryKey: ['managers'],
    queryFn: async (): Promise<Manager[]> => {
      const { data, error } = await supabase.from('managers').select('*').order('display_name')
      if (error) throw error
      return data ?? []
    },
    staleTime: 60_000,
  })
}

export function useCredits() {
  return useQuery({
    queryKey: ['credits'],
    queryFn: async (): Promise<ManagerCredits[]> => {
      const { data, error } = await supabase.from('v_manager_credits').select('*')
      if (error) throw error
      return data ?? []
    },
    staleTime: 10_000,
  })
}

export function useMyCredits(): ManagerCredits | undefined {
  const { manager } = useAuth()
  const { data } = useCredits()
  return data?.find((c) => c.id === manager?.id)
}

export function usePlayers() {
  return useQuery({
    queryKey: ['players'],
    queryFn: async (): Promise<Player[]> => {
      const { data, error } = await supabase.from('players').select('*').order('name')
      if (error) throw error
      return data ?? []
    },
    staleTime: 30_000,
  })
}

export function useClaimTeam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (teamName: string) => {
      const { error } = await supabase.rpc('claim_team', { p_team_name: teamName })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['managers'] })
      qc.invalidateQueries({ queryKey: ['partite'] })
    },
  })
}

export function useAuctions() {
  return useQuery({
    queryKey: ['auctions'],
    queryFn: async (): Promise<Auction[]> => {
      const { data, error } = await supabase
        .from('auctions')
        .select('*')
        .order('id', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    staleTime: 5_000,
  })
}

export function useAuction(id: number | undefined) {
  return useQuery({
    queryKey: ['auction', id],
    enabled: id != null,
    queryFn: async (): Promise<Auction | null> => {
      const { data, error } = await supabase.from('auctions').select('*').eq('id', id!).maybeSingle()
      if (error) throw error
      return data
    },
    staleTime: 2_000,
  })
}

export function useBids(auctionId: number | undefined) {
  return useQuery({
    queryKey: ['bids', auctionId],
    enabled: auctionId != null,
    queryFn: async (): Promise<Bid[]> => {
      const { data, error } = await supabase
        .from('bids')
        .select('*')
        .eq('auction_id', auctionId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    staleTime: 2_000,
  })
}

export function useParticipants(auctionId: number | undefined) {
  return useQuery({
    queryKey: ['participants', auctionId],
    enabled: auctionId != null,
    queryFn: async (): Promise<Participant[]> => {
      const { data, error } = await supabase
        .from('auction_participants')
        .select('*')
        .eq('auction_id', auctionId!)
      if (error) throw error
      return data ?? []
    },
    staleTime: 2_000,
  })
}

export function useMyParticipations() {
  const { manager } = useAuth()
  return useQuery({
    queryKey: ['my-participations', manager?.id],
    enabled: !!manager?.id,
    queryFn: async (): Promise<Participant[]> => {
      const { data, error } = await supabase
        .from('auction_participants')
        .select('*')
        .eq('manager_id', manager!.id)
      if (error) throw error
      return data ?? []
    },
    staleTime: 5_000,
  })
}

export function useMyAutobid(auctionId: number | undefined) {
  const { manager } = useAuth()
  return useQuery({
    queryKey: ['autobid', auctionId, manager?.id],
    enabled: auctionId != null && !!manager?.id,
    queryFn: async (): Promise<Autobid | null> => {
      const { data, error } = await supabase
        .from('autobids')
        .select('*')
        .eq('auction_id', auctionId!)
        .eq('manager_id', manager!.id)
        .maybeSingle()
      if (error) throw error
      return data
    },
    staleTime: 2_000,
  })
}

function invalidateAll(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ['auctions'] })
  qc.invalidateQueries({ queryKey: ['auction'] })
  qc.invalidateQueries({ queryKey: ['bids'] })
  qc.invalidateQueries({ queryKey: ['participants'] })
  qc.invalidateQueries({ queryKey: ['my-participations'] })
  qc.invalidateQueries({ queryKey: ['credits'] })
  qc.invalidateQueries({ queryKey: ['autobid'] })
  qc.invalidateQueries({ queryKey: ['players'] })
}

/** Sottoscrizione realtime globale: invalida le query quando il DB cambia. */
export function useRealtime() {
  const qc = useQueryClient()
  useEffect(() => {
    const channel = supabase
      .channel('db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auctions' }, () =>
        invalidateAll(qc),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bids' }, () => {
        qc.invalidateQueries({ queryKey: ['bids'] })
        qc.invalidateQueries({ queryKey: ['auctions'] })
        qc.invalidateQueries({ queryKey: ['auction'] })
        qc.invalidateQueries({ queryKey: ['credits'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auction_participants' }, () => {
        qc.invalidateQueries({ queryKey: ['participants'] })
        qc.invalidateQueries({ queryKey: ['my-participations'] })
      })
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [qc])
}
