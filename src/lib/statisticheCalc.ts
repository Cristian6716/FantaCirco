// Logica pura della sezione Statistiche: unifica le fonti di partite
// (campionato corrente + storico stagioni passate + bracket Coppa risolto),
// calcola i record da "statistiche campionato" e gli scontri diretti (H2H).
import { calculateCampionatoStandings, type CampionatoRow } from './tornei'

export const STAGIONE_CORRENTE = 'Stagione corrente'

export interface StatMatch {
  stagione: string
  competizione: 'campionato' | 'coppa'
  giornata: number
  casa: string
  trasferta: string
  golCasa: number
  golTrasferta: number
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

export interface MargineRecord {
  stagione: string
  squadra: string
  puntiPrimo: number
  puntiSecondo: number
  margine: number
}

export interface AnticipoRecord {
  stagione: string
  squadra: string
  giornateTotali: number
  giornateAnticipo: number
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
  partitaMenoGol: MatchRecord | null
  margineMassimo: MargineRecord | null
  anticipoMassimo: AnticipoRecord | null
  strisceImbattibilita: StrisciaRecord[]
}

/** Record calcolati solo sulle partite di campionato (storico + corrente). */
export function calculateCampionatoRecords(allMatches: StatMatch[]): CampionatoRecords {
  const matches = allMatches.filter((m) => m.competizione === 'campionato')
  if (matches.length === 0) {
    return {
      partitaPiuGol: null,
      partitaMenoGol: null,
      margineMassimo: null,
      anticipoMassimo: null,
      strisceImbattibilita: [],
    }
  }

  // ---- Partita con più/meno gol totali ----
  let partitaPiuGol: MatchRecord | null = null
  let partitaMenoGol: MatchRecord | null = null
  for (const m of matches) {
    const golTotali = m.golCasa + m.golTrasferta
    if (!partitaPiuGol || golTotali > partitaPiuGol.golTotali) partitaPiuGol = { match: m, golTotali }
    if (!partitaMenoGol || golTotali < partitaMenoGol.golTotali) partitaMenoGol = { match: m, golTotali }
  }

  const bySeason = groupBy(matches, (m) => m.stagione)

  let margineMassimo: MargineRecord | null = null
  let anticipoMassimo: AnticipoRecord | null = null
  const strisce: StrisciaRecord[] = []

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

    // ---- Giornate d'anticipo del campione ----
    const giornateOrdinate = Array.from(new Set(seasonMatches.map((m) => m.giornata))).sort((a, b) => a - b)
    if (giornateOrdinate.length > 0 && finalStandings.length >= 2) {
      const campione = finalStandings[0].team
      const standingsPerGiornata = giornateOrdinate.map((g) => {
        const upTo = seasonMatches.filter((m) => m.giornata <= g)
        return calculateCampionatoStandings(toPartitaResult(upTo), teams)
      })
      const soleLeader = (standings: CampionatoRow[]) =>
        standings.length >= 2 && standings[0].team === campione && standings[0].pts > standings[1].pts

      let k0 = giornateOrdinate.length // indice (1-based count) da cui il primato è ininterrotto
      for (let i = giornateOrdinate.length - 1; i >= 0; i--) {
        if (soleLeader(standingsPerGiornata[i])) k0 = i + 1
        else break
      }
      const giornateAnticipo = giornateOrdinate.length - k0
      if (giornateAnticipo > 0 && (!anticipoMassimo || giornateAnticipo > anticipoMassimo.giornateAnticipo)) {
        anticipoMassimo = {
          stagione,
          squadra: campione,
          giornateTotali: giornateOrdinate.length,
          giornateAnticipo,
        }
      }
    }

    // ---- Striscia di imbattibilità più lunga ----
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
        const lost = gf < gs
        if (lost) {
          current = 0
        } else {
          if (current === 0) currentStart = m.giornata
          current += 1
          const best = strisce.find((s) => s.stagione === stagione && s.squadra === team)
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
              strisce.push(record)
            }
          }
        }
      }
    }
  }

  const maxLunghezza = strisce.reduce((max, s) => Math.max(max, s.lunghezza), 0)
  const strisceImbattibilita = strisce
    .filter((s) => s.lunghezza === maxLunghezza && maxLunghezza > 0)
    .sort((a, b) => a.squadra.localeCompare(b.squadra, 'it'))

  return { partitaPiuGol, partitaMenoGol, margineMassimo, anticipoMassimo, strisceImbattibilita }
}

// ---------------- Albo d'oro ----------------

export interface AlboOroEntry {
  id: number
  stagione: string
  competizione: 'campionato' | 'coppa' | 'battle_royale'
  squadra: string
  note: string | null
}

export interface AlboOroLeaderboardRow {
  squadra: string
  totale: number
  campionato: number
  coppa: number
  battle_royale: number
  trofei: AlboOroEntry[]
}

export function calculateAlboOroLeaderboard(entries: AlboOroEntry[]): AlboOroLeaderboardRow[] {
  const rows = new Map<string, AlboOroLeaderboardRow>()
  for (const e of entries) {
    if (!rows.has(e.squadra)) {
      rows.set(e.squadra, { squadra: e.squadra, totale: 0, campionato: 0, coppa: 0, battle_royale: 0, trofei: [] })
    }
    const row = rows.get(e.squadra)!
    row.totale += 1
    row[e.competizione] += 1
    row.trofei.push(e)
  }
  return Array.from(rows.values()).sort((a, b) => b.totale - a.totale || a.squadra.localeCompare(b.squadra, 'it'))
}

// ---------------- Scontri diretti (H2H) ----------------

export interface H2HMatchDetail {
  stagione: string
  competizione: 'campionato' | 'coppa'
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
  return [...row.matches].sort((a, b) => a.giornata - b.giornata)
}

export function allTeamsInMatches(matches: StatMatch[]): string[] {
  return distinctTeams(matches).sort((a, b) => a.localeCompare(b, 'it'))
}
