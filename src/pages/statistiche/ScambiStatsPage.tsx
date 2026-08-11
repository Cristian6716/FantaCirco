import { useMemo } from 'react'
import { useScambi, useScambioGiocatori, type ScambioGiocatore } from '../../lib/scambi'
import { EmptyState, PageLoader } from '../../components/ui'

export default function ScambiStatsPage() {
  const { data: scambi, isLoading: loadingScambi } = useScambi()
  const { data: scambioGiocatori, isLoading: loadingGiocatori } = useScambioGiocatori()

  const giocatoriPerScambio = useMemo(() => {
    const map = new Map<number, ScambioGiocatore[]>()
    for (const g of scambioGiocatori ?? []) {
      const arr = map.get(g.scambio_id) ?? []
      arr.push(g)
      map.set(g.scambio_id, arr)
    }
    return map
  }, [scambioGiocatori])

  if (loadingScambi || loadingGiocatori) return <PageLoader />

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-white">Storico scambi</h1>

      {!scambi || scambi.length === 0 ? (
        <EmptyState icon="🔄" title="Nessuno scambio ancora" hint="Gli scambi tra rose eseguiti dall'admin compariranno qui" />
      ) : (
        <>
          <p className="text-xs text-slate-400">{scambi.length} scambi registrati</p>
          <div className="space-y-2.5">
            {scambi.map((s) => {
              const giocatori = giocatoriPerScambio.get(s.id) ?? []
              const daA = giocatori.filter((g) => g.da === s.squadra_a)
              const daB = giocatori.filter((g) => g.da === s.squadra_b)
              return (
                <div key={s.id} className="rounded-xl border border-border bg-surface p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-white">
                      {s.squadra_a} ↔ {s.squadra_b}
                    </p>
                    <span className="shrink-0 whitespace-nowrap text-[11px] text-slate-500">
                      {new Date(s.data).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </span>
                  </div>
                  <div className="mt-1.5 space-y-0.5 text-sm text-slate-300">
                    {daA.length > 0 && (
                      <p>
                        {s.squadra_a} → {s.squadra_b}: {daA.map((g) => g.giocatore).join(', ')}
                      </p>
                    )}
                    {daB.length > 0 && (
                      <p>
                        {s.squadra_b} → {s.squadra_a}: {daB.map((g) => g.giocatore).join(', ')}
                      </p>
                    )}
                    {s.crediti_a > 0 && (
                      <p>
                        {s.squadra_a} → {s.squadra_b}: {s.crediti_a} crediti
                      </p>
                    )}
                    {s.crediti_b > 0 && (
                      <p>
                        {s.squadra_b} → {s.squadra_a}: {s.crediti_b} crediti
                      </p>
                    )}
                    {s.note && <p className="text-slate-500">Nota: {s.note}</p>}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
