// Logica pura della sezione Statistiche: unifica le fonti di partite
// (campionato corrente + storico stagioni passate + torneo: svizzero, gironi e
// bracket Coppa), calcola i record da "statistiche campionato" e gli scontri
// diretti (H2H).
import { calculateCampionatoStandings } from './tornei'

export const STAGIONE_CORRENTE = 'Stagione corrente'

/** Competizione di provenienza di una partita nelle statistiche unificate. */
export type Competizione = 'campionato' | 'svizzero' | 'girone' | 'coppa'

export interface StatMatch {
  stagione: string
  competizione: Competizione
  giornata: number
  casa: string
  trasferta: string
  golCasa: number
  golTrasferta: number
  puntiCasa: number | null
  puntiTrasferta: number | null
}

/** Righe pronte per calculateCampionatoStandings (stessa forma di PartitaResult). */
function toPartitaResult(matches: StatMatch[]) {
  return matches.map((m) => ({
    giornata: m.giornata,
    casa: m.casa,
    trasferta: m.trasferta,
    gol_casa: m.golCasa,
    gol_trasferta: m.golTrasferta,
  }))
}

function distinctTeams(matches: StatMatch[]): string[] {
  const set = new Set<string>()
  for (const m of matches) {
    set.add(m.casa)
    set.add(m.trasferta)
  }
  return Array.from(set)
}

function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>()
  for (const item of items) {
    const k = key(item)
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(item)
  }
  return map
}

// ---------------- Record campionato ----------------

export interface MatchRecord {
  match: StatMatch
  golTotali: number
}

export interface PuntiRecord {
  match: StatMatch
  puntiCasa: number
  puntiTrasferta: number
  puntiTotali: number
}

export interface MargineRecord {
  stagione: string
  squadra: string
  puntiPrimo: number
  puntiSecondo: number
  margine: number
}

export interface GiornateInTestaRecord {
  stagione: string
  squadra: string
  giornateTotali: number
  giornateInTesta: number
}

export interface StrisciaRecord {
  stagione: string
  squadra: string
  lunghezza: number
  giornataInizio: number
  giornataFine: number
}

export interface CampionatoRecords {
  partitaPiuGol: MatchRecord | null
  partitaMenoPunti: PuntiRecord | null
  margineMassimo: MargineRecord | null
  giornateInTestaMassimo: GiornateInTestaRecord | null
  strisceImbattibilita: StrisciaRecord[]
  strischeVittorie: StrisciaRecord[]
  strischeSconfitte: StrisciaRecord[]
}

/** Record calcolati solo sulle partite di campionato (storico + corrente). */
export function calculateCampionatoRecords(allMatches: StatMatch[]): CampionatoRecords {
  const matches = allMatches.filter((m) => m.competizione === 'campionato')
  if (matches.length === 0) {
    return {
      partitaPiuGol: null,
      partitaMenoPunti: null,
      margineMassimo: null,
      giornateInTestaMassimo: null,
      strisceImbattibilita: [],
      strischeVittorie: [],
      strischeSconfitte: [],
    }
  }

  // ---- Partita con più gol totali (reali) / meno punti fantacalcio totali ----
  let partitaPiuGol: MatchRecord | null = null
  let partitaMenoPunti: PuntiRecord | null = null
  for (const m of matches) {
    const golTotali = m.golCasa + m.golTrasferta
    if (!partitaPiuGol || golTotali > partitaPiuGol.golTotali) partitaPiuGol = { match: m, golTotali }
    if (m.puntiCasa != null && m.puntiTrasferta != null) {
      const puntiTotali = m.puntiCasa + m.puntiTrasferta
      if (!partitaMenoPunti || puntiTotali < partitaMenoPunti.puntiTotali) {
        partitaMenoPunti = { match: m, puntiCasa: m.puntiCasa, puntiTrasferta: m.puntiTrasferta, puntiTotali }
      }
    }
  }

  const bySeason = groupBy(matches, (m) => m.stagione)

  let margineMassimo: MargineRecord | null = null
  let giornateInTestaMassimo: GiornateInTestaRecord | null = null
  const strisce: StrisciaRecord[] = []
  const strischeV: StrisciaRecord[] = []
  const strischeS: StrisciaRecord[] = []

  for (const [stagione, seasonMatches] of bySeason) {
    const teams = distinctTeams(seasonMatches)
    const finalStandings = calculateCampionatoStandings(toPartitaResult(seasonMatches), teams)

    // ---- Margine di vittoria (1° vs 2°) ----
    if (finalStandings.length >= 2) {
      const margine = finalStandings[0].pts - finalStandings[1].pts
      if (!margineMassimo || margine > margineMassimo.margine) {
        margineMassimo = {
          stagione,
          squadra: finalStandings[0].team,
          puntiPrimo: finalStandings[0].pts,
          puntiSecondo: finalStandings[1].pts,
          margine,
        }
      }
    }

    // ---- Più giornate da sola in testa in una singola stagione ----
    const giornateOrdinate = Array.from(new Set(seasonMatches.map((m) => m.giornata))).sort((a, b) => a - b)
    if (giornateOrdinate.length > 0) {
      const standingsPerGiornata = giornateOrdinate.map((g) => {
        const upTo = seasonMatches.filter((m) => m.giornata <= g)
        return calculateCampionatoStandings(toPartitaResult(upTo), teams)
      })
      const giornateInTestaByTeam = new Map<string, number>()
      for (const standings of standingsPerGiornata) {
        if (standings.length >= 2 && standings[0].pts > standings[1].pts) {
          const leader = standings[0].team
          giornateInTestaByTeam.set(leader, (giornateInTestaByTeam.get(leader) ?? 0) + 1)
        }
      }
      for (const [squadra, giornateInTesta] of giornateInTestaByTeam) {
        if (!giornateInTestaMassimo || giornateInTesta > giornateInTestaMassimo.giornateInTesta) {
          giornateInTestaMassimo = {
            stagione,
            squadra,
            giornateTotali: giornateOrdinate.length,
            giornateInTesta,
          }
        }
      }
    }

    // ---- Striscia di imbattibilità / vittorie / sconfitte più lunga ----
    const trackStreak = (
      bucket: StrisciaRecord[],
      isStreak: (lost: boolean, esito: 'V' | 'N' | 'P') => boolean,
    ) => {
      for (const team of teams) {
        const teamMatches = seasonMatches
          .filter((m) => m.casa === team || m.trasferta === team)
          .sort((a, b) => a.giornata - b.giornata)

        let current = 0
        let currentStart = 0
        for (const m of teamMatches) {
          const isCasa = m.casa === team
          const gf = isCasa ? m.golCasa : m.golTrasferta
          const gs = isCasa ? m.golTrasferta : m.golCasa
          const esito: 'V' | 'N' | 'P' = gf > gs ? 'V' : gf < gs ? 'P' : 'N'
          if (isStreak(gf < gs, esito)) {
            if (current === 0) currentStart = m.giornata
            current += 1
            const best = bucket.find((s) => s.stagione === stagione && s.squadra === team)
            if (!best || current > best.lunghezza) {
              const record: StrisciaRecord = {
                stagione,
                squadra: team,
                lunghezza: current,
                giornataInizio: currentStart,
                giornataFine: m.giornata,
              }
              if (best) {
                best.lunghezza = record.lunghezza
                best.giornataInizio = record.giornataInizio
                best.giornataFine = record.giornataFine
              } else {
                bucket.push(record)
              }
            }
          } else {
            current = 0
          }
        }
      }
    }

    trackStreak(strisce, (lost) => !lost)
    trackStreak(strischeV, (_lost, esito) => esito === 'V')
    trackStreak(strischeS, (_lost, esito) => esito === 'P')
  }

  const topStreaks = (bucket: StrisciaRecord[]): StrisciaRecord[] => {
    const max = bucket.reduce((m, s) => Math.max(m, s.lunghezza), 0)
    return bucket
      .filter((s) => s.lunghezza === max && max > 0)
      .sort((a, b) => a.squadra.localeCompare(b.squadra, 'it'))
  }

  const strisceImbattibilita = topStreaks(strisce)
  const strischeVittorie = topStreaks(strischeV)
  const strischeSconfitte = topStreaks(strischeS)

  return {
    partitaPiuGol,
    partitaMenoPunti,
    margineMassimo,
    giornateInTestaMassimo,
    strisceImbattibilita,
    strischeVittorie,
    strischeSconfitte,
  }
}

// ---------------- Scontri diretti (H2H) ----------------

export interface H2HMatchDetail {
  stagione: string
  competizione: Competizione
  giornata: number
  team: string
  opponent: string
  gf: number
  gs: number
  esito: 'V' | 'N' | 'P'
}

export interface H2HRow {
  opponent: string
  g: number
  w: number
  d: number
  l: number
  gf: number
  gs: number
  matches: H2HMatchDetail[]
}

/** Scontri diretti di `team` contro ogni altra squadra apparsa nelle partite unificate. */
export function calculateH2HForTeam(matches: StatMatch[], team: string): H2HRow[] {
  const rows = new Map<string, H2HRow>()
  for (const m of matches) {
    if (m.casa !== team && m.trasferta !== team) continue
    const isCasa = m.casa === team
    const opponent = isCasa ? m.trasferta : m.casa
    const gf = isCasa ? m.golCasa : m.golTrasferta
    const gs = isCasa ? m.golTrasferta : m.golCasa
    const esito: H2HMatchDetail['esito'] = gf > gs ? 'V' : gf < gs ? 'P' : 'N'

    if (!rows.has(opponent)) {
      rows.set(opponent, { opponent, g: 0, w: 0, d: 0, l: 0, gf: 0, gs: 0, matches: [] })
    }
    const row = rows.get(opponent)!
    row.g += 1
    row.gf += gf
    row.gs += gs
    if (esito === 'V') row.w += 1
    else if (esito === 'N') row.d += 1
    else row.l += 1
    row.matches.push({ stagione: m.stagione, competizione: m.competizione, giornata: m.giornata, team, opponent, gf, gs, esito })
  }
  return Array.from(rows.values()).sort((a, b) => a.opponent.localeCompare(b.opponent, 'it'))
}

/** Dettaglio scontri diretti tra due squadre specifiche (ordine cronologico). */
export function calculateH2HBetween(matches: StatMatch[], teamA: string, teamB: string): H2HMatchDetail[] {
  const rows = calculateH2HForTeam(matches, teamA)
  const row = rows.find((r) => r.opponent === teamB)
  if (!row) return []
  // Nella stagione corrente la stessa giornata porta sia la partita di
  // campionato sia quella di torneo: la competizione fa da spareggio, altrimenti
  // l'ordine di due partite con lo stesso numero di giornata sarebbe arbitrario.
  return [...row.matches].sort(
    (a, b) => a.giornata - b.giornata || a.competizione.localeCompare(b.competizione),
  )
}

export function allTeamsInMatches(matches: StatMatch[]): string[] {
  return distinctTeams(matches).sort((a, b) => a.localeCompare(b, 'it'))
}
