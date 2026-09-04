// Ranking generale della stagione in corso, calcolato live dalle tre
// competizioni. Stessa struttura dello snapshot storico `ranking_generale`
// (Campionato + Battle Royale + Torneo) ma derivato dai dati correnti, quindi
// provvisorio: cambia a ogni giornata.

import type { CampionatoRow, ClassificaRow } from './tornei'
import type { RankingTorneoRow } from './rankingTorneo'
import type { GironeLabel } from './rankingTorneo'

/** Pesi per posizione, identici allo storico: 1° = (N) x peso, ultimo = 1 x peso. */
export const PESO_CAMPIONATO = 10
export const PESO_ROYALE = 5

/**
 * Punti per posizione in classifica: chi è primo prende il massimo, chi è
 * ultimo un solo "scalino". Con 16 squadre e peso 10: 1° 160, 16° 10.
 */
export function puntiPosizione(pos: number, numSquadre: number, peso: number): number {
  if (pos < 1 || pos > numSquadre) return 0
  return (numSquadre + 1 - pos) * peso
}

export interface RankingStagioneRow {
  teamName: string
  managerId: string | null
  campionatoPos: number
  campionatoPts: number
  royalePos: number
  royalePts: number
  torneoPts: number
  torneoSvizzero: number
  torneoGirone: number
  torneoGironeLabel: GironeLabel | null
  totale: number
  pos: number
}

/**
 * Somma le tre componenti per squadra. Campionato e Battle Royale sono
 * indicizzati per nome squadra, il torneo per manager: il join passa da
 * teamNameById. La fase a eliminazione del torneo non è ancora conteggiata.
 */
export function buildRankingStagione(
  campionato: CampionatoRow[],
  royale: ClassificaRow[],
  torneo: RankingTorneoRow[],
  teamNameById: Map<string, string>,
): RankingStagioneRow[] {
  const rows = new Map<string, RankingStagioneRow>()

  const ensure = (teamName: string): RankingStagioneRow => {
    let row = rows.get(teamName)
    if (!row) {
      row = {
        teamName,
        managerId: null,
        campionatoPos: 0,
        campionatoPts: 0,
        royalePos: 0,
        royalePts: 0,
        torneoPts: 0,
        torneoSvizzero: 0,
        torneoGirone: 0,
        torneoGironeLabel: null,
        totale: 0,
        pos: 0,
      }
      rows.set(teamName, row)
    }
    return row
  }

  for (const r of campionato) {
    const row = ensure(r.team)
    row.campionatoPos = r.pos
    row.campionatoPts = puntiPosizione(r.pos, campionato.length, PESO_CAMPIONATO)
  }

  for (const r of royale) {
    const row = ensure(r.team)
    row.royalePos = r.pos
    row.royalePts = puntiPosizione(r.pos, royale.length, PESO_ROYALE)
  }

  for (const r of torneo) {
    const teamName = teamNameById.get(r.managerId)
    if (!teamName) continue
    const row = ensure(teamName)
    row.managerId = r.managerId
    row.torneoSvizzero = r.svizzero
    row.torneoGirone = r.girone
    row.torneoGironeLabel = r.gironeLabel
    row.torneoPts = r.totale
  }

  const list = [...rows.values()]
  list.forEach((r) => {
    r.totale = r.campionatoPts + r.royalePts + r.torneoPts
  })
  list.sort((a, b) => b.totale - a.totale || a.teamName.localeCompare(b.teamName))
  list.forEach((r, i) => {
    r.pos = i + 1
  })
  return list
}
