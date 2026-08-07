// Logica tornei: Battle Royale (girone all'italiana su scontri diretti derivati
// dai punteggi fanta) + bracket a eliminazione.
// Portata da fanta_tornei/src/utils/{battleRoyaleLogic,torneoLogic}.js.

export type GiornateScores = Record<string, Record<string, number>>

/**
 * Gol da punteggio fanta. Fasce ogni 6 punti:
 * <66 = 0, 66-71.99 = 1, 72-77.99 = 2, 78-83.99 = 3, ...
 */
export function calculateGoals(score: number): number {
  if (score < 66) return 0
  return Math.floor((score - 66) / 6) + 1
}

export interface MatchResult {
  golA: number
  golB: number
  result: 'A' | 'B' | 'D'
  ptsA: number
  ptsB: number
}

/**
 * Risultato di uno scontro diretto tra due punteggi fanta.
 * Stessa fascia:  diff < 3 → pareggio; diff >= 3 → vince il punteggio più alto.
 * Fasce diverse:  diff < 2 → pareggio alla fascia superiore; altrimenti ognuno la propria.
 */
export function calculateMatchResult(scoreA: number, scoreB: number): MatchResult {
  const bandA = calculateGoals(scoreA)
  const bandB = calculateGoals(scoreB)
  const diff = Math.abs(scoreA - scoreB)

  let golA: number
  let golB: number

  if (bandA === bandB) {
    if (diff < 3) {
      golA = bandA
      golB = bandB
    } else if (scoreA > scoreB) {
      golA = bandA
      golB = Math.max(0, bandA - 1)
    } else {
      golA = Math.max(0, bandB - 1)
      golB = bandB
    }
  } else if (diff < 2) {
    const maxBand = Math.max(bandA, bandB)
    golA = maxBand
    golB = maxBand
  } else {
    golA = bandA
    golB = bandB
  }

  let result: 'A' | 'B' | 'D'
  if (golA > golB) result = 'A'
  else if (golB > golA) result = 'B'
  else result = 'D'

  const ptsA = result === 'A' ? 3 : result === 'D' ? 1 : 0
  const ptsB = result === 'B' ? 3 : result === 'D' ? 1 : 0

  return { golA, golB, result, ptsA, ptsB }
}

export interface Scontro extends MatchResult {
  teamA: string
  teamB: string
  scoreA: number
  scoreB: number
}

/** Tutti gli scontri (16*15/2 = 120) di una giornata. */
export function processGiornata(punteggi: Record<string, number>, teams: string[]): Scontro[] {
  const results: Scontro[] = []
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      const teamA = teams[i]
      const teamB = teams[j]
      const scoreA = punteggi[teamA]
      const scoreB = punteggi[teamB]
      if (scoreA == null || scoreB == null) continue
      results.push({ teamA, teamB, scoreA, scoreB, ...calculateMatchResult(scoreA, scoreB) })
    }
  }
  return results
}

export interface ClassificaRow {
  team: string
  pos: number
  pts: number
  w: number
  d: number
  l: number
  gf: number
  gs: number
  dr: number
  fantaTotal: number
  lastDelta: number
}

export interface StoricoGiornata {
  giornata: number
  punteggi: Record<string, number>
  dayStats: Record<string, { w: number; d: number; l: number; gf: number; gs: number; pts: number }>
}

export interface BattleRoyaleResult {
  classifica: ClassificaRow[]
  storico: StoricoGiornata[]
  scontriPerGiornata: Record<string, Scontro[]>
}

/** Classifica Battle Royale completa da tutte le giornate inserite. */
export function calculateStandings(giornate: GiornateScores, teams: string[]): BattleRoyaleResult {
  const stats: Record<string, ClassificaRow> = {}
  teams.forEach((team) => {
    stats[team] = { team, pos: 0, pts: 0, w: 0, d: 0, l: 0, gf: 0, gs: 0, dr: 0, fantaTotal: 0, lastDelta: 0 }
  })

  const storico: StoricoGiornata[] = []
  const scontriPerGiornata: Record<string, Scontro[]> = {}

  const sortedGiornate = Object.entries(giornate).sort(([a], [b]) => Number(a) - Number(b))

  for (const [numGiornata, punteggi] of sortedGiornate) {
    const results = processGiornata(punteggi, teams)
    scontriPerGiornata[numGiornata] = results

    const dayStats: StoricoGiornata['dayStats'] = {}
    teams.forEach((team) => {
      dayStats[team] = { w: 0, d: 0, l: 0, gf: 0, gs: 0, pts: 0 }
      stats[team].fantaTotal += punteggi[team] || 0
    })

    for (const match of results) {
      dayStats[match.teamA].gf += match.golA
      dayStats[match.teamA].gs += match.golB
      dayStats[match.teamA].pts += match.ptsA
      if (match.result === 'A') dayStats[match.teamA].w++
      else if (match.result === 'D') dayStats[match.teamA].d++
      else dayStats[match.teamA].l++

      dayStats[match.teamB].gf += match.golB
      dayStats[match.teamB].gs += match.golA
      dayStats[match.teamB].pts += match.ptsB
      if (match.result === 'B') dayStats[match.teamB].w++
      else if (match.result === 'D') dayStats[match.teamB].d++
      else dayStats[match.teamB].l++
    }

    teams.forEach((team) => {
      stats[team].w += dayStats[team].w
      stats[team].d += dayStats[team].d
      stats[team].l += dayStats[team].l
      stats[team].gf += dayStats[team].gf
      stats[team].gs += dayStats[team].gs
      stats[team].pts += dayStats[team].pts
    })

    storico.push({ giornata: Number(numGiornata), punteggi: { ...punteggi }, dayStats: { ...dayStats } })
  }

  if (storico.length > 0) {
    const lastDay = storico[storico.length - 1]
    teams.forEach((team) => {
      stats[team].lastDelta = lastDay.dayStats[team]?.pts || 0
    })
  }

  const classifica = Object.values(stats).sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts
    const drA = a.gf - a.gs
    const drB = b.gf - b.gs
    if (drB !== drA) return drB - drA
    if (b.gf !== a.gf) return b.gf - a.gf
    return b.fantaTotal - a.fantaTotal
  })

  classifica.forEach((team, idx) => {
    team.pos = idx + 1
    team.dr = team.gf - team.gs
  })

  return { classifica, storico, scontriPerGiornata }
}

// ---- Bracket a eliminazione ----

export interface TorneoMatch {
  id: string
  day: number
  bracket: 'upper' | 'mid' | 'lower' | 'finals'
  teamA: string
  teamB: string
  scoreA: number | null
  scoreB: number | null
  winner: 'A' | 'B' | null
  eliminated: 'A' | 'B' | null
  eliminationMatch: boolean
  golA?: number
  golB?: number
  draw?: boolean
  label?: string
}

export interface TorneoOverrideInput {
  winner: 'A' | 'B'
  /** Gol di sola visualizzazione, per quando manca il punteggio reale di un lato. */
  golA?: number | null
  golB?: number | null
}

/**
 * Risolve il bracket in base ai punteggi delle giornate.
 * Usa lo stesso sistema di gol/fasce della Battle Royale; in caso di parità
 * perfetta di punteggio fanta serve un override manuale (winner 'A'/'B').
 */
export function resolveTournament(
  initialMatches: TorneoMatch[],
  giornate: GiornateScores,
  overrides: Record<string, TorneoOverrideInput> = {},
): TorneoMatch[] {
  const matches: TorneoMatch[] = JSON.parse(JSON.stringify(initialMatches))
  matches.sort((a, b) => a.day - b.day)

  for (const match of matches) {
    const isPlaceholderA = match.teamA.startsWith('Vinc.') || match.teamA.startsWith('Perd.')
    const isPlaceholderB = match.teamB.startsWith('Vinc.') || match.teamB.startsWith('Perd.')
    if (isPlaceholderA || isPlaceholderB) continue

    const dayScores = giornate[String(match.day)] ?? {}
    const scoreA = dayScores[match.teamA]
    const scoreB = dayScores[match.teamB]
    if (scoreA != null) match.scoreA = scoreA
    if (scoreB != null) match.scoreB = scoreB

    if (scoreA != null && scoreB != null) {
      const result = calculateMatchResult(scoreA, scoreB)
      match.golA = result.golA
      match.golB = result.golB

      if (result.golA > result.golB) {
        match.winner = 'A'
      } else if (result.golB > result.golA) {
        match.winner = 'B'
      } else if (scoreA !== scoreB) {
        match.winner = scoreA > scoreB ? 'A' : 'B'
      } else {
        match.draw = true
      }
    }

    // Nessun punteggio per una delle due (es. squadra non più in lega): serve
    // uno spareggio manuale identico a quello dei pareggi perfetti. golA/golB
    // dell'override sono di sola visualizzazione (non usati per calcolare nulla).
    const ovr = overrides[match.id]
    if (match.winner == null && ovr) {
      match.winner = ovr.winner
      if (match.golA == null && ovr.golA != null) match.golA = ovr.golA
      if (match.golB == null && ovr.golB != null) match.golB = ovr.golB
    }

    if (match.winner == null) continue

    if (match.eliminationMatch) {
      match.eliminated = match.winner === 'A' ? 'B' : 'A'
    }

    const winnerTeam = match.winner === 'A' ? match.teamA : match.teamB
    const loserTeam = match.winner === 'A' ? match.teamB : match.teamA

    for (const m of matches) {
      if (m.teamA === `Vinc. ${match.id}`) m.teamA = winnerTeam
      if (m.teamB === `Vinc. ${match.id}`) m.teamB = winnerTeam
      if (m.teamA === `Perd. ${match.id}`) m.teamA = loserTeam
      if (m.teamB === `Perd. ${match.id}`) m.teamB = loserTeam
    }
  }

  return matches
}
