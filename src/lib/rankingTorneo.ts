// Punti ranking del Torneo Megagalattico (format svizzero → gironi →
// eliminazione). A differenza dei punti interni al torneo (3 a vittoria, 1 a
// pareggio, usati per le classifiche dei gironi), questi alimentano il ranking
// generale e pesano ogni vittoria in base alla situazione in cui arriva.
//
// I punti della fase a eliminazione non sono ancora stati definiti.

import type { GironeRow, SwissMatchResolved } from './megagalattico'

export type GironeLabel = 'A' | 'B'

/**
 * Punti ranking per una vittoria nello svizzero, in base al record V-P che il
 * vincitore aveva *prima* della partita: più sei avanti, più la vittoria pesa.
 *
 *   2-0 / 2-1 (diff +2 / +1) → 5 / 3    0-0 / 1-1 / 2-2 (diff 0) → 2
 *   0-1 / 1-2 / 0-2 (diff negativa)     → 1
 */
export function puntiSvizzeroVittoria(wins: number, losses: number): number {
  const diff = wins - losses
  if (diff >= 2) return 5
  if (diff === 1) return 3
  if (diff === 0) return 2
  return 1
}

/** Punti ranking di una vittoria/pareggio nei gironi: il Girone A vale doppio. */
export const PUNTI_GIRONE: Record<GironeLabel, { vittoria: number; pareggio: number }> = {
  A: { vittoria: 4, pareggio: 2 },
  B: { vittoria: 2, pareggio: 1 },
}

export function puntiGirone(row: Pick<GironeRow, 'w' | 'd'>, girone: GironeLabel): number {
  const tab = PUNTI_GIRONE[girone]
  return row.w * tab.vittoria + row.d * tab.pareggio
}

export interface RankingTorneoRow {
  managerId: string
  /** Punti maturati nella fase a sistema svizzero. */
  svizzero: number
  /** Punti maturati nel girone (0 finché i gironi non sono generati). */
  girone: number
  gironeLabel: GironeLabel | null
  totale: number
  pos: number
}

/**
 * Punti ranking torneo di ogni squadra: somma delle vittorie svizzere pesate
 * per record più il rendimento nel girone. La fase a eliminazione non è
 * ancora conteggiata.
 */
export function buildRankingTorneo(
  swissMatches: SwissMatchResolved[],
  classificaA: GironeRow[],
  classificaB: GironeRow[],
  allManagerIds: string[],
): RankingTorneoRow[] {
  const rows = new Map<string, RankingTorneoRow>()
  for (const id of allManagerIds) {
    rows.set(id, { managerId: id, svizzero: 0, girone: 0, gironeLabel: null, totale: 0, pos: 0 })
  }

  for (const m of swissMatches) {
    if (m.winner == null) continue
    const winnerId = m.winner === 'A' ? m.managerA : m.managerB
    const rec = m.winner === 'A' ? m.recordA : m.recordB
    const row = rows.get(winnerId)
    if (row) row.svizzero += puntiSvizzeroVittoria(rec.wins, rec.losses)
  }

  for (const [label, classifica] of [
    ['A', classificaA],
    ['B', classificaB],
  ] as [GironeLabel, GironeRow[]][]) {
    for (const r of classifica) {
      const row = rows.get(r.managerId)
      if (!row) continue
      row.gironeLabel = label
      row.girone = puntiGirone(r, label)
    }
  }

  const list = [...rows.values()]
  list.forEach((r) => {
    r.totale = r.svizzero + r.girone
  })
  list.sort((a, b) => b.totale - a.totale || b.svizzero - a.svizzero)
  list.forEach((r, i) => {
    r.pos = i + 1
  })
  return list
}
