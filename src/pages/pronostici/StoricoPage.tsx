import { useMemo } from 'react'
import { useGiornate, usePartite } from '../../lib/leagueQueries'
import { EmptyState, PageLoader } from '../../components/ui'

export default function StoricoPage() {
  const { data: giornate } = useGiornate()
  const { data: partite } = usePartite()

  const giocate = useMemo(() => {
    if (!giornate || !partite) return []
    return giornate
      .map((g) => ({
        numero: g.numero,
        partite: partite
          .filter((p) => p.giornata === g.numero && p.gol_casa !== null && p.gol_trasferta !== null)
          .sort((a, b) => a.ordine - b.ordine),
      }))
      .filter((g) => g.partite.length > 0)
      .sort((a, b) => b.numero - a.numero)
  }, [giornate, partite])

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-white">Storico</h1>
      {!giornate || !partite ? (
        <PageLoader />
      ) : giocate.length === 0 ? (
        <EmptyState icon="📜" title="Nessun risultato" hint="I risultati appariranno qui una volta inseriti." />
      ) : (
        <div className="space-y-3">
          {giocate.map((g) => (
            <div key={g.numero} className="rounded-xl border border-border bg-surface p-3">
              <p className="mb-2 text-sm font-semibold text-white">Giornata {g.numero}</p>
              <div className="space-y-1">
                {g.partite.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="min-w-0 flex-1 truncate text-right text-slate-300">{p.casa}</span>
                    <span className="shrink-0 rounded bg-surface-2 px-1.5 py-0.5 font-bold text-white">
                      {p.gol_casa}-{p.gol_trasferta}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-slate-300">{p.trasferta}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
