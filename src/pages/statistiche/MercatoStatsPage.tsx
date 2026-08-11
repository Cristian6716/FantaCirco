import { useStatisticheMercato } from '../../lib/statisticheQueries'
import { EmptyState, PageLoader } from '../../components/ui'

function formatData(value: string | null): string | null {
  if (!value) return null
  return new Date(value).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })
}

export default function MercatoStatsPage() {
  const { data: voci, isLoading } = useStatisticheMercato()

  if (isLoading) return <PageLoader />

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-white">Statistiche mercato</h1>

      {!voci || voci.length === 0 ? (
        <EmptyState icon="📝" title="Nessuna voce ancora" hint="L'admin può aggiungerle da Amministrazione" />
      ) : (
        <div className="space-y-2.5">
          {voci.map((v) => (
            <div key={v.id} className="rounded-xl border border-border bg-surface p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-white">{v.titolo}</p>
                {formatData(v.data) && (
                  <span className="shrink-0 whitespace-nowrap text-[11px] text-slate-500">{formatData(v.data)}</span>
                )}
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-300">{v.testo}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
