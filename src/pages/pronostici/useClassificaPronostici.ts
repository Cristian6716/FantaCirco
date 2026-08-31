import { useMemo } from 'react'
import { useManagers } from '../../lib/queries'
import { usePartite, usePronostici } from '../../lib/leagueQueries'
import { puntiPronostico } from '../../lib/pronostici'

export interface RigaClassifica {
  managerId: string
  nome: string
  punti: number
  /** Punti fatti nell'ultima giornata calcolata (0 se non ha pronosticato). */
  puntiUltima: number
  azzeccati1X2: number
  azzeccatiOU: number
}

export interface ClassificaPronostici {
  rows: RigaClassifica[]
  /** Numero dell'ultima giornata con almeno un risultato inserito. */
  ultimaGiornata: number | null
}

export function useClassificaPronostici(): ClassificaPronostici {
  const { data: managers } = useManagers()
  const { data: partite } = usePartite()
  const { data: pronostici } = usePronostici()

  return useMemo(() => {
    if (!managers || !partite || !pronostici) return { rows: [], ultimaGiornata: null }
    const partitaMap = new Map(partite.map((p) => [p.id, p]))
    // Ultima giornata calcolata = la più alta con almeno un risultato inserito.
    let ultimaGiornata: number | null = null
    for (const p of partite) {
      if (p.gol_casa === null || p.gol_trasferta === null) continue
      if (ultimaGiornata === null || p.giornata > ultimaGiornata) ultimaGiornata = p.giornata
    }
    const rows = new Map<string, RigaClassifica>()
    for (const m of managers) {
      if (!m.team_name) continue
      rows.set(m.id, {
        managerId: m.id,
        nome: m.team_name || m.display_name,
        punti: 0,
        puntiUltima: 0,
        azzeccati1X2: 0,
        azzeccatiOU: 0,
      })
    }
    for (const pr of pronostici) {
      const row = rows.get(pr.manager_id)
      if (!row) continue
      const partita = partitaMap.get(pr.partita_id)
      if (!partita) continue
      const punti = puntiPronostico(pr, partita.gol_casa, partita.gol_trasferta)
      if (!punti) continue
      const totale = punti.punti1X2 + punti.puntiOU
      row.punti += totale
      if (partita.giornata === ultimaGiornata) row.puntiUltima += totale
      if (punti.punti1X2 === 3) row.azzeccati1X2++
      if (punti.puntiOU === 1) row.azzeccatiOU++
    }
    return {
      rows: Array.from(rows.values()).sort(
        (a, b) => b.punti - a.punti || b.azzeccati1X2 - a.azzeccati1X2,
      ),
      ultimaGiornata,
    }
  }, [managers, partite, pronostici])
}
