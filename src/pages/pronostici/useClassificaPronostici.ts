import { useMemo } from 'react'
import { useManagers } from '../../lib/queries'
import { usePartite, usePronostici } from '../../lib/leagueQueries'
import { puntiPronostico } from '../../lib/pronostici'

export interface RigaClassifica {
  managerId: string
  nome: string
  punti: number
  azzeccati1X2: number
  azzeccatiOU: number
}

export function useClassificaPronostici(): RigaClassifica[] {
  const { data: managers } = useManagers()
  const { data: partite } = usePartite()
  const { data: pronostici } = usePronostici()

  return useMemo(() => {
    if (!managers || !partite || !pronostici) return []
    const partitaMap = new Map(partite.map((p) => [p.id, p]))
    const rows = new Map<string, RigaClassifica>()
    for (const m of managers) {
      if (!m.team_name) continue
      rows.set(m.id, {
        managerId: m.id,
        nome: m.team_name || m.display_name,
        punti: 0,
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
      row.punti += punti.punti1X2 + punti.puntiOU
      if (punti.punti1X2 === 3) row.azzeccati1X2++
      if (punti.puntiOU === 1) row.azzeccatiOU++
    }
    return Array.from(rows.values()).sort(
      (a, b) => b.punti - a.punti || b.azzeccati1X2 - a.azzeccati1X2,
    )
  }, [managers, partite, pronostici])
}
