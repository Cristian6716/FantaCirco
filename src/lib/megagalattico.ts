// Torneo Megagalattico — prima fase (sistema svizzero + gironi A/B).
// La fase finale (Coppa) resta quella di torneoData.ts/tornei.ts, invariata.
// Logica pura + query/mutation/realtime Supabase, stesso stile di tornei.ts
// e leagueQueries.ts.

import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import type { Tables } from './database.types'
import {
  calculateMatchResult,
  resolveMatchWinner,
  type GiornateScores,
  type TorneoOverrideInput,
} from './tornei'

export const SWISS_TURNI = 5
export const GIRONE_ROUNDS = 7

export type MegaTurno = Tables<'mega_turni'>
export type MegaAccoppiamento = Tables<'mega_accoppiamenti'>
export type MegaGironePartita = Tables<'mega_gironi_partite'>
export type MegaCoppaSeeding = Tables<'mega_coppa_seeding'>

// ============================================================================
// Helpers condivisi
// ============================================================================

export function buildTeamNameMap(managers: { id: string; team_name: string | null }[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const m of managers) if (m.team_name) map.set(m.id, m.team_name)
  return map
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

// ============================================================================
// Sistema svizzero
// ============================================================================

export type SwissStatus = 'active' | 'qualified' | 'eliminated'

export interface SwissTeamState {
  managerId: string
  wins: number
  losses: number
  status: SwissStatus
  opponents: Set<string>
}

export interface SwissMatchResolved {
  turno: number
  managerA: string
  managerB: string
  giornataReale: number | null
  scoreA: number | null
  scoreB: number | null
  golA: number | null
  golB: number | null
  winner: 'A' | 'B' | null
  /** Parità esatta di punteggio fanta: serve uno spareggio admin (torneo_overrides). */
  draw: boolean
  /** Record V-P condiviso dalle due squadre all'inizio del turno, es. "1-0". */
  record: string
  /** Record V-P della singola squadra a inizio turno: nei gruppi "galleggiati"
   *  le due squadre possono non condividerlo, e i punti ranking dipendono da
   *  quello di chi vince. */
  recordA: { wins: number; losses: number }
  recordB: { wins: number; losses: number }
}

export interface SwissResolution {
  states: Map<string, SwissTeamState>
  matches: SwissMatchResolved[]
}

/** Match id sintetico per riusare la tabella torneo_overrides esistente. */
export function megaSwissOverrideId(turno: number, managerA: string, managerB: string): string {
  return `MEGA-SW-T${turno}-${managerA}-${managerB}`
}

/**
 * Risolve lo stato dello svizzero turno per turno: record V-P di ogni
 * squadra, stato (attiva/qualificata a 3 vittorie/eliminata a 3 sconfitte),
 * e il dettaglio di ogni match giocato. Serve calcolare i turni in ordine
 * perché il record di un turno dipende dai risultati di quello precedente
 * (stesso principio a cascata di resolveTournament in tornei.ts).
 */
export function resolveSwissState(
  accoppiamenti: { turno: number; manager_a: string; manager_b: string }[],
  turniMapping: Map<number, number | null>,
  scores: GiornateScores,
  teamNameById: Map<string, string>,
  overrides: Record<string, TorneoOverrideInput>,
  allManagerIds: string[],
): SwissResolution {
  const states = new Map<string, SwissTeamState>()
  for (const id of allManagerIds) {
    states.set(id, { managerId: id, wins: 0, losses: 0, status: 'active', opponents: new Set() })
  }

  const byTurno = new Map<number, { manager_a: string; manager_b: string }[]>()
  for (const a of accoppiamenti) {
    if (!byTurno.has(a.turno)) byTurno.set(a.turno, [])
    byTurno.get(a.turno)!.push(a)
  }

  const matches: SwissMatchResolved[] = []
  const turni = [...byTurno.keys()].sort((a, b) => a - b)

  for (const turno of turni) {
    const giornataReale = turniMapping.get(turno) ?? null
    const dayScores = giornataReale != null ? scores[String(giornataReale)] ?? {} : {}

    for (const { manager_a, manager_b } of byTurno.get(turno)!) {
      const teamA = teamNameById.get(manager_a)
      const teamB = teamNameById.get(manager_b)
      const scoreA = teamA != null ? dayScores[teamA] ?? null : null
      const scoreB = teamB != null ? dayScores[teamB] ?? null : null

      let golA: number | null = null
      let golB: number | null = null
      let winner: 'A' | 'B' | null = null
      let draw = false

      if (scoreA != null && scoreB != null) {
        const resolved = resolveMatchWinner(scoreA, scoreB)
        golA = resolved.golA
        golB = resolved.golB
        winner = resolved.winner
        draw = resolved.draw
        if (draw) {
          const ovr = overrides[megaSwissOverrideId(turno, manager_a, manager_b)]
          if (ovr) winner = ovr.winner
        }
      }

      const stateA = states.get(manager_a)
      const stateB = states.get(manager_b)
      const recordA = { wins: stateA?.wins ?? 0, losses: stateA?.losses ?? 0 }
      const recordB = { wins: stateB?.wins ?? 0, losses: stateB?.losses ?? 0 }
      const record = `${recordA.wins}-${recordA.losses}`

      matches.push({
        turno,
        managerA: manager_a,
        managerB: manager_b,
        giornataReale,
        scoreA,
        scoreB,
        golA,
        golB,
        winner,
        draw,
        record,
        recordA,
        recordB,
      })

      stateA?.opponents.add(manager_b)
      stateB?.opponents.add(manager_a)

      if (winner === 'A' && stateA && stateB) {
        stateA.wins++
        stateB.losses++
      } else if (winner === 'B' && stateA && stateB) {
        stateB.wins++
        stateA.losses++
      }
    }

    for (const state of states.values()) {
      if (state.status !== 'active') continue
      if (state.wins >= 3) state.status = 'qualified'
      else if (state.losses >= 3) state.status = 'eliminated'
    }
  }

  return { states, matches }
}

/**
 * Genera il sorteggio del prossimo turno: raggruppa le squadre attive per
 * record V-P, accoppia a caso dentro ogni gruppo evitando rematch (retry
 * dello shuffle; fallback al rematch solo come ultima spiaggia). Gruppi di
 * dimensione dispari (non dovrebbe succedere con 16 squadre e soglia 3/3,
 * verificato sull'esempio del formato) vengono "galleggiati" nel gruppo di
 * record adiacente, come nello svizzero classico.
 */
export function generateSwissPairing(
  activeStates: { managerId: string; wins: number; losses: number }[],
  opponentsOf: (managerId: string) => Set<string>,
  rng: () => number = Math.random,
): [string, string][] {
  const hasPlayed = (a: string, b: string) => opponentsOf(a).has(b)

  const groups = new Map<string, string[]>()
  for (const s of activeStates) {
    const key = `${s.wins}-${s.losses}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(s.managerId)
  }
  const orderedKeys = [...groups.keys()].sort((a, b) => {
    const [wa, la] = a.split('-').map(Number)
    const [wb, lb] = b.split('-').map(Number)
    return wb - wa || la - lb
  })

  const pairWithinGroup = (pool: string[]): [string, string][] => {
    const MAX_ATTEMPTS = 25
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const shuffled = shuffle(pool, rng)
      const candidate: [string, string][] = []
      let ok = true
      for (let i = 0; i < shuffled.length; i += 2) {
        const a = shuffled[i]
        const b = shuffled[i + 1]
        if (b === undefined) continue
        if (hasPlayed(a, b)) {
          ok = false
          break
        }
        candidate.push([a, b])
      }
      if (ok) return candidate
    }
    // Fallback: rematch inevitabile, meglio di non accoppiare.
    const shuffled = shuffle(pool, rng)
    const candidate: [string, string][] = []
    for (let i = 0; i < shuffled.length; i += 2) {
      if (shuffled[i + 1] !== undefined) candidate.push([shuffled[i], shuffled[i + 1]])
    }
    return candidate
  }

  const pairs: [string, string][] = []
  let floating: string[] = []
  for (const key of orderedKeys) {
    const pool = [...floating, ...groups.get(key)!]
    floating = pool.length % 2 !== 0 ? [pool.pop()!] : []
    pairs.push(...pairWithinGroup(pool))
  }
  if (floating.length > 0) pairs.push(...pairWithinGroup(floating))

  return pairs
}

export interface SwissFinalRecord {
  managerId: string
  wins: number
  losses: number
}

/** Divide le 16 squadre a fine svizzero: record positivo → Girone A, negativo → Girone B. */
export function splitSwissToGironi(finalStates: SwissFinalRecord[]): {
  gironeA: SwissFinalRecord[]
  gironeB: SwissFinalRecord[]
} {
  const gironeA = finalStates
    .filter((s) => s.wins > s.losses)
    .sort((a, b) => b.wins - a.wins || a.losses - b.losses)
  const gironeB = finalStates
    .filter((s) => s.losses > s.wins)
    .sort((a, b) => b.wins - a.wins || a.losses - b.losses)
  return { gironeA, gironeB }
}

// ============================================================================
// Gironi A/B (round robin)
// ============================================================================

export interface RoundRobinMatch {
  round: number
  managerA: string
  managerB: string
}

/** Calendario girone all'italiana (circle method), nessun sorteggio: ordine = seed passato. */
export function generateRoundRobin(managerIds: string[]): RoundRobinMatch[] {
  const teams = [...managerIds]
  if (teams.length % 2 !== 0) teams.push('__BYE__')
  const n = teams.length
  const fixed = teams[0]
  let rotating = teams.slice(1)
  const matches: RoundRobinMatch[] = []

  for (let round = 1; round <= n - 1; round++) {
    const roundTeams = [fixed, ...rotating]
    for (let i = 0; i < n / 2; i++) {
      const a = roundTeams[i]
      const b = roundTeams[n - 1 - i]
      if (a !== '__BYE__' && b !== '__BYE__') matches.push({ round, managerA: a, managerB: b })
    }
    rotating = [rotating[rotating.length - 1], ...rotating.slice(0, -1)]
  }
  return matches
}

export interface GironeRow {
  managerId: string
  swissWins: number
  swissLosses: number
  w: number
  d: number
  l: number
  gf: number
  gs: number
  dr: number
  pts: number
  pos: number
}

/**
 * Classifica combinata di un girone: il record svizzero si somma a quello
 * del girone (pareggi inclusi, a differenza dello svizzero che non ne
 * ammette). Usa calculateMatchResult direttamente (non resolveMatchWinner:
 * qui il pareggio è un esito legittimo, non serve spareggio admin).
 */
export function resolveGironeStandings(
  teamIds: string[],
  swissRecords: Map<string, { wins: number; losses: number }>,
  partite: RoundRobinMatch[],
  roundToGiornata: Map<number, number | null>,
  scores: GiornateScores,
  teamNameById: Map<string, string>,
): GironeRow[] {
  const rows = new Map<string, GironeRow>()
  for (const id of teamIds) {
    const sw = swissRecords.get(id) ?? { wins: 0, losses: 0 }
    rows.set(id, {
      managerId: id,
      swissWins: sw.wins,
      swissLosses: sw.losses,
      w: 0,
      d: 0,
      l: 0,
      gf: 0,
      gs: 0,
      dr: 0,
      pts: sw.wins * 3,
      pos: 0,
    })
  }

  for (const p of partite) {
    const giornataReale = roundToGiornata.get(p.round) ?? null
    if (giornataReale == null) continue
    const dayScores = scores[String(giornataReale)] ?? {}
    const teamA = teamNameById.get(p.managerA)
    const teamB = teamNameById.get(p.managerB)
    const scoreA = teamA != null ? dayScores[teamA] : undefined
    const scoreB = teamB != null ? dayScores[teamB] : undefined
    if (scoreA == null || scoreB == null) continue

    const result = calculateMatchResult(scoreA, scoreB)
    const rowA = rows.get(p.managerA)
    const rowB = rows.get(p.managerB)
    if (!rowA || !rowB) continue

    rowA.gf += result.golA
    rowA.gs += result.golB
    rowB.gf += result.golB
    rowB.gs += result.golA
    rowA.pts += result.ptsA
    rowB.pts += result.ptsB
    if (result.result === 'A') {
      rowA.w++
      rowB.l++
    } else if (result.result === 'B') {
      rowB.w++
      rowA.l++
    } else {
      rowA.d++
      rowB.d++
    }
  }

  const list = [...rows.values()]
  list.forEach((r) => {
    r.dr = r.gf - r.gs
  })
  list.sort((a, b) => b.pts - a.pts || b.dr - a.dr || b.gf - a.gf)
  list.forEach((r, i) => {
    r.pos = i + 1
  })
  return list
}

export interface GironeMatchResolved {
  round: number
  managerA: string
  managerB: string
  giornataReale: number | null
  golA: number | null
  golB: number | null
}

/**
 * Match dei gironi con i gol già risolti dai punteggi fanta. resolveGironeStandings
 * aggrega direttamente in classifica: questa espone invece il singolo risultato,
 * che serve agli scontri diretti e alle rivalità.
 */
export function resolveGironeMatches(
  partite: RoundRobinMatch[],
  roundToGiornata: Map<number, number | null>,
  scores: GiornateScores,
  teamNameById: Map<string, string>,
): GironeMatchResolved[] {
  const out: GironeMatchResolved[] = []
  for (const p of partite) {
    const giornataReale = roundToGiornata.get(p.round) ?? null
    const dayScores = giornataReale != null ? scores[String(giornataReale)] ?? {} : {}
    const teamA = teamNameById.get(p.managerA)
    const teamB = teamNameById.get(p.managerB)
    const scoreA = teamA != null ? dayScores[teamA] : undefined
    const scoreB = teamB != null ? dayScores[teamB] : undefined

    let golA: number | null = null
    let golB: number | null = null
    if (scoreA != null && scoreB != null) {
      const result = calculateMatchResult(scoreA, scoreB)
      golA = result.golA
      golB = result.golB
    }

    out.push({ round: p.round, managerA: p.managerA, managerB: p.managerB, giornataReale, golA, golB })
  }
  return out
}

// ============================================================================
// Fasce finali + sorteggio verso la Coppa
// ============================================================================

export interface Fasce {
  elite: string[] // 1°-4° Girone A
  outsider: string[] // 5°-8° Girone A
  rivelazioni: string[] // 1°-4° Girone B
  fondo: string[] // 5°-8° Girone B
}

export function splitToFasce(classificaA: GironeRow[], classificaB: GironeRow[]): Fasce {
  return {
    elite: classificaA.slice(0, 4).map((r) => r.managerId),
    outsider: classificaA.slice(4, 8).map((r) => r.managerId),
    rivelazioni: classificaB.slice(0, 4).map((r) => r.managerId),
    fondo: classificaB.slice(4, 8).map((r) => r.managerId),
  }
}

export interface CoppaSeedingMatch {
  bracket: 'upper' | 'mid' | 'lower'
  managerA: string
  managerB: string
}

/**
 * Sorteggio finale: elite → upper (2 match), outsider+rivelazioni → mid (4
 * match), fondo → lower (2 match) — unica combinazione compatibile con le
 * dimensioni upper/mid/lower del bracket Coppa attuale (torneoData.ts).
 */
export function drawCoppaSeeding(fasce: Fasce, rng: () => number = Math.random): CoppaSeedingMatch[] {
  const pairTier = (ids: string[], bracket: CoppaSeedingMatch['bracket']): CoppaSeedingMatch[] => {
    const shuffled = shuffle(ids, rng)
    const out: CoppaSeedingMatch[] = []
    for (let i = 0; i < shuffled.length; i += 2) {
      if (shuffled[i + 1] !== undefined) out.push({ bracket, managerA: shuffled[i], managerB: shuffled[i + 1] })
    }
    return out
  }
  return [
    ...pairTier(fasce.elite, 'upper'),
    ...pairTier([...fasce.outsider, ...fasce.rivelazioni], 'mid'),
    ...pairTier(fasce.fondo, 'lower'),
  ]
}

// ============================================================================
// Query
// ============================================================================

export function useMegaTurni() {
  return useQuery({
    queryKey: ['mega_turni'],
    queryFn: async (): Promise<MegaTurno[]> => {
      const { data, error } = await supabase.from('mega_turni').select('*').order('step_type').order('step_numero')
      if (error) throw error
      return data ?? []
    },
    staleTime: 30_000,
  })
}

export function useMegaAccoppiamenti() {
  return useQuery({
    queryKey: ['mega_accoppiamenti'],
    queryFn: async (): Promise<MegaAccoppiamento[]> => {
      const { data, error } = await supabase.from('mega_accoppiamenti').select('*').order('turno')
      if (error) throw error
      return data ?? []
    },
    staleTime: 15_000,
  })
}

export function useMegaGironiPartite() {
  return useQuery({
    queryKey: ['mega_gironi_partite'],
    queryFn: async (): Promise<MegaGironePartita[]> => {
      const { data, error } = await supabase
        .from('mega_gironi_partite')
        .select('*')
        .order('girone')
        .order('round')
      if (error) throw error
      return data ?? []
    },
    staleTime: 15_000,
  })
}

export function useMegaCoppaSeeding() {
  return useQuery({
    queryKey: ['mega_coppa_seeding'],
    queryFn: async (): Promise<MegaCoppaSeeding[]> => {
      const { data, error } = await supabase.from('mega_coppa_seeding').select('*').order('bracket')
      if (error) throw error
      return data ?? []
    },
    staleTime: 15_000,
  })
}

// ============================================================================
// Mutation admin
// ============================================================================

export function useAdminSetMegaTurno() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { step_type: 'svizzero' | 'gironi'; step_numero: number; giornata_reale: number | null }) => {
      const { error } = await supabase.from('mega_turni').upsert(input, { onConflict: 'step_type,step_numero' })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mega_turni'] }),
  })
}

export function useAdminSorteggiaTurno() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { turno: number; pairs: [string, string][] }) => {
      const rows = input.pairs.map(([manager_a, manager_b]) => ({
        turno: input.turno,
        manager_a,
        manager_b,
      }))
      const { error } = await supabase.from('mega_accoppiamenti').insert(rows)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mega_accoppiamenti'] }),
  })
}

export function useAdminGeneraGironi() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { partiteA: RoundRobinMatch[]; partiteB: RoundRobinMatch[] }) => {
      const rows = [
        ...input.partiteA.map((p) => ({ girone: 'A' as const, round: p.round, manager_a: p.managerA, manager_b: p.managerB })),
        ...input.partiteB.map((p) => ({ girone: 'B' as const, round: p.round, manager_a: p.managerA, manager_b: p.managerB })),
      ]
      const { error } = await supabase.from('mega_gironi_partite').insert(rows)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mega_gironi_partite'] }),
  })
}

export function useAdminSorteggiaCoppa() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (matches: CoppaSeedingMatch[]) => {
      const { error: delError } = await supabase.from('mega_coppa_seeding').delete().gte('id', 0)
      if (delError) throw new Error(delError.message)
      const rows = matches.map((m) => ({ bracket: m.bracket, manager_a: m.managerA, manager_b: m.managerB }))
      const { error } = await supabase.from('mega_coppa_seeding').insert(rows)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mega_coppa_seeding'] }),
  })
}

// ============================================================================
// Realtime
// ============================================================================

export function useMegagalatticoRealtime() {
  const qc = useQueryClient()
  useEffect(() => {
    const channel = supabase
      .channel('megagalattico-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mega_turni' }, () =>
        qc.invalidateQueries({ queryKey: ['mega_turni'] }),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mega_accoppiamenti' }, () =>
        qc.invalidateQueries({ queryKey: ['mega_accoppiamenti'] }),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mega_gironi_partite' }, () =>
        qc.invalidateQueries({ queryKey: ['mega_gironi_partite'] }),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mega_coppa_seeding' }, () =>
        qc.invalidateQueries({ queryKey: ['mega_coppa_seeding'] }),
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [qc])
}
