// Dati condivisi delle viste del Torneo Megagalattico: risolve svizzero e
// classifiche combinate dei due gironi a partire dai punteggi di giornata.
// Estratto da MegagalatticoPage per essere riusato anche dal ranking di
// stagione nella pagina Ranking.

import { useMemo } from 'react'
import { useManagers } from './queries'
import { buildGiornateScores, useOverrides, usePunteggiGiornata } from './leagueQueries'
import {
  buildTeamNameMap,
  resolveGironeMatches,
  resolveGironeStandings,
  resolveSwissState,
  useMegaAccoppiamenti,
  useMegaGironiPartite,
  useMegaTurni,
  type RoundRobinMatch,
} from './megagalattico'
import type { TorneoOverrideInput } from './tornei'

/** Dati condivisi dalle viste del torneo: classifiche combinate svizzero+girone. */
export function useMegaData() {
  const { data: managers } = useManagers()
  const { data: punteggi } = usePunteggiGiornata()
  const { data: overrides } = useOverrides()
  const { data: megaTurni } = useMegaTurni()
  const { data: accoppiamenti } = useMegaAccoppiamenti()
  const { data: gironiPartite } = useMegaGironiPartite()

  const squadre = useMemo(() => (managers ?? []).filter((m) => !!m.team_name), [managers])
  const teamNameById = useMemo(() => buildTeamNameMap(squadre), [squadre])
  const allIds = useMemo(() => squadre.map((m) => m.id), [squadre])

  const scoresMap = useMemo(() => {
    if (!managers || !punteggi) return {}
    return buildGiornateScores(punteggi, managers)
  }, [managers, punteggi])

  const overrideMap = useMemo(() => {
    const ovr: Record<string, TorneoOverrideInput> = {}
    for (const o of overrides ?? []) ovr[o.match_id] = { winner: o.winner as 'A' | 'B', golA: o.gol_a, golB: o.gol_b }
    return ovr
  }, [overrides])

  const turniSvizzero = useMemo(() => {
    const m = new Map<number, number | null>()
    for (const t of megaTurni ?? []) if (t.step_type === 'svizzero') m.set(t.step_numero, t.giornata_reale)
    return m
  }, [megaTurni])

  const turniGironi = useMemo(() => {
    const m = new Map<number, number | null>()
    for (const t of megaTurni ?? []) if (t.step_type === 'gironi') m.set(t.step_numero, t.giornata_reale)
    return m
  }, [megaTurni])

  const swiss = useMemo(() => {
    if (allIds.length === 0) return null
    return resolveSwissState(accoppiamenti ?? [], turniSvizzero, scoresMap, teamNameById, overrideMap, allIds)
  }, [accoppiamenti, turniSvizzero, scoresMap, teamNameById, overrideMap, allIds])

  const swissRecordsMap = useMemo(() => {
    const m = new Map<string, { wins: number; losses: number }>()
    for (const s of swiss?.states.values() ?? []) m.set(s.managerId, { wins: s.wins, losses: s.losses })
    return m
  }, [swiss])

  const partiteA = useMemo(
    () =>
      (gironiPartite ?? [])
        .filter((p) => p.girone === 'A')
        .map((p): RoundRobinMatch => ({ round: p.round, managerA: p.manager_a, managerB: p.manager_b })),
    [gironiPartite],
  )
  const partiteB = useMemo(
    () =>
      (gironiPartite ?? [])
        .filter((p) => p.girone === 'B')
        .map((p): RoundRobinMatch => ({ round: p.round, managerA: p.manager_a, managerB: p.manager_b })),
    [gironiPartite],
  )
  const idsA = useMemo(() => [...new Set(partiteA.flatMap((p) => [p.managerA, p.managerB]))], [partiteA])
  const idsB = useMemo(() => [...new Set(partiteB.flatMap((p) => [p.managerA, p.managerB]))], [partiteB])

  const classificaA = useMemo(
    () => resolveGironeStandings(idsA, swissRecordsMap, partiteA, turniGironi, scoresMap, teamNameById),
    [idsA, swissRecordsMap, partiteA, turniGironi, scoresMap, teamNameById],
  )
  const matchesA = useMemo(
    () => resolveGironeMatches(partiteA, turniGironi, scoresMap, teamNameById),
    [partiteA, turniGironi, scoresMap, teamNameById],
  )
  const matchesB = useMemo(
    () => resolveGironeMatches(partiteB, turniGironi, scoresMap, teamNameById),
    [partiteB, turniGironi, scoresMap, teamNameById],
  )

  const classificaB = useMemo(
    () => resolveGironeStandings(idsB, swissRecordsMap, partiteB, turniGironi, scoresMap, teamNameById),
    [idsB, swissRecordsMap, partiteB, turniGironi, scoresMap, teamNameById],
  )

  return {
    managers,
    teamNameById,
    allIds,
    gironiPartite,
    swiss,
    classificaA,
    classificaB,
    matchesA,
    matchesB,
    partiteA,
    partiteB,
    turniGironi,
    scoresMap,
  }
}
