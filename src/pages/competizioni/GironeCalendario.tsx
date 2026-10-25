import { useState } from 'react'
import { GIRONE_ROUNDS, type GironeMatchResolved } from '../../lib/megagalattico'
import MatchScoreEditor from './MatchScoreEditor'

/**
 * Calendario e risultati di un girone, giornata per giornata. Per l'admin
 * ogni partita ha gli input dei punteggi fanta (salvati in punteggi_giornata).
 */
export default function GironeCalendario({
  title,
  matches,
  teamNameById,
  scoresMap,
  isAdmin,
}: {
  title: string
  matches: GironeMatchResolved[]
  teamNameById: Map<string, string>
  scoresMap: Record<string, Record<string, number>>
  isAdmin: boolean
}) {
  const rounds = Array.from({ length: GIRONE_ROUNDS }, (_, i) => i + 1).filter((r) =>
    matches.some((m) => m.round === r),
  )
  // Apre di default il primo turno ancora incompleto.
  const firstOpen = rounds.find((r) => matches.some((m) => m.round === r && m.golA == null)) ?? rounds[rounds.length - 1]
  const [open, setOpen] = useState<number | null>(firstOpen ?? null)

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="bg-surface-2 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {title} · calendario
      </div>
      <div className="divide-y divide-border">
        {rounds.map((r) => {
          const ms = matches.filter((m) => m.round === r)
          const giornata = ms[0]?.giornataReale ?? null
          const isOpen = open === r
          return (
            <div key={r}>
              <button
                onClick={() => setOpen(isOpen ? null : r)}
                className="flex w-full items-center justify-between px-3 py-2 text-left"
              >
                <span className="text-sm font-semibold text-white">Turno {r}</span>
                <span className="text-xs text-slate-400">
                  {giornata != null ? `Giornata ${giornata}` : 'Giornata da definire'} {isOpen ? '▴' : '▾'}
                </span>
              </button>
              {isOpen && (
                <div className="space-y-1.5 px-3 pb-3">
                  {ms.map((m) => {
                    const nameA = teamNameById.get(m.managerA) ?? m.managerA
                    const nameB = teamNameById.get(m.managerB) ?? m.managerB
                    const played = m.golA != null && m.golB != null
                    const day = giornata != null ? scoresMap[String(giornata)] ?? {} : {}
                    const scoreA = day[nameA] ?? null
                    const scoreB = day[nameB] ?? null
                    return (
                      <div key={`${m.managerA}-${m.managerB}`} className="rounded-lg bg-surface-2 px-2.5 py-1.5 text-sm">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={[
                              'min-w-0 flex-1 truncate font-medium',
                              played && m.golA! > m.golB! ? 'text-emerald-300' : 'text-slate-200',
                            ].join(' ')}
                          >
                            {nameA}
                          </span>
                          <span className="shrink-0 rounded-md border border-border bg-surface px-1.5 py-0.5 text-[11px] font-bold text-white">
                            {played ? `${m.golA}-${m.golB}` : '–'}
                          </span>
                          <span
                            className={[
                              'min-w-0 flex-1 truncate text-right font-medium',
                              played && m.golB! > m.golA! ? 'text-emerald-300' : 'text-slate-200',
                            ].join(' ')}
                          >
                            {nameB}
                          </span>
                        </div>
                        {isAdmin ? (
                          <MatchScoreEditor
                            giornata={giornata}
                            managerA={m.managerA}
                            managerB={m.managerB}
                            scoreA={scoreA}
                            scoreB={scoreB}
                          />
                        ) : (
                          !played && <p className="mt-0.5 text-[10px] text-slate-500">Da giocare</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
