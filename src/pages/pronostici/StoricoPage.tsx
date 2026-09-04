import { useMemo, useState } from 'react'
import { useGiornate, usePartite, usePronostici, type Partita } from '../../lib/leagueQueries'
import { calcolaRisultati, ouLabel, puntiPronostico } from '../../lib/pronostici'
import { EmptyState, PageLoader } from '../../components/ui'
import { useAuth } from '../../auth/AuthProvider'

interface RigaPartita {
  partita: Partita
  /** Le mie scelte, null se non ho pronosticato questa partita. */
  mio1X2: string | null
  mioOU: string | null
  esatto1X2: boolean
  esattoOU: boolean
  punti: number
}

interface GiornataStorico {
  numero: number
  righe: RigaPartita[]
  punti: number
  pronosticate: number
}

export default function StoricoPage() {
  const { manager } = useAuth()
  const { data: giornate } = useGiornate()
  const { data: partite } = usePartite()
  const { data: pronostici } = usePronostici()

  // Solo i miei pronostici, indicizzati per partita.
  const mieiPerPartita = useMemo(() => {
    const map = new Map<string, { pronostico_1x2: string; pronostico_ou: string }>()
    if (!manager) return map
    for (const p of pronostici ?? []) {
      if (p.manager_id === manager.id) map.set(p.partita_id, p)
    }
    return map
  }, [pronostici, manager])

  const giocate = useMemo((): GiornataStorico[] => {
    if (!giornate || !partite) return []
    return giornate
      .map((g) => {
        const righe = partite
          .filter((p) => p.giornata === g.numero && p.gol_casa !== null && p.gol_trasferta !== null)
          .sort((a, b) => a.ordine - b.ordine)
          .map((partita): RigaPartita => {
            const mio = mieiPerPartita.get(partita.id) ?? null
            const punti = mio
              ? puntiPronostico(mio, partita.gol_casa, partita.gol_trasferta)
              : null
            return {
              partita,
              mio1X2: mio?.pronostico_1x2 ?? null,
              mioOU: mio?.pronostico_ou ?? null,
              esatto1X2: punti ? punti.punti1X2 > 0 : false,
              esattoOU: punti ? punti.puntiOU > 0 : false,
              punti: punti ? punti.punti1X2 + punti.puntiOU : 0,
            }
          })
        return {
          numero: g.numero,
          righe,
          punti: righe.reduce((acc, r) => acc + r.punti, 0),
          pronosticate: righe.filter((r) => r.mio1X2 && r.mioOU).length,
        }
      })
      .filter((g) => g.righe.length > 0)
      .sort((a, b) => b.numero - a.numero)
  }, [giornate, partite, mieiPerPartita])

  // Totali di stagione, calcolati solo sulle partite che ho pronosticato.
  const totali = useMemo(() => {
    let punti = 0
    let giocate1X2 = 0
    let esatti1X2 = 0
    let esattiOU = 0
    for (const g of giocate) {
      for (const r of g.righe) {
        if (!r.mio1X2 || !r.mioOU) continue
        giocate1X2 += 1
        punti += r.punti
        if (r.esatto1X2) esatti1X2 += 1
        if (r.esattoOU) esattiOU += 1
      }
    }
    return { punti, giocate1X2, esatti1X2, esattiOU }
  }, [giocate])

  // Aperta/chiusa per giornata: l'ultima giocata parte aperta, un toggle manuale
  // sovrascrive il default (stesso schema delle sezioni del menu).
  const [overrides, setOverrides] = useState<Record<number, boolean>>({})
  const ultima = giocate[0]?.numero ?? null

  if (!giornate || !partite || !pronostici) return <PageLoader />

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-white">Storico</h1>
        <p className="mt-0.5 text-xs text-slate-400">
          I tuoi pronostici sulle giornate già chiuse, con l&apos;esito di ciascuno.
        </p>
      </div>

      {giocate.length === 0 ? (
        <EmptyState icon="📜" title="Nessun risultato" hint="I risultati appariranno qui una volta inseriti." />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            <StatCard label="Punti" valore={totali.punti} />
            <StatCard
              label="Esito 1X2"
              valore={`${totali.esatti1X2}/${totali.giocate1X2}`}
              nota={percentuale(totali.esatti1X2, totali.giocate1X2)}
            />
            <StatCard
              label={ouLabel()}
              valore={`${totali.esattiOU}/${totali.giocate1X2}`}
              nota={percentuale(totali.esattiOU, totali.giocate1X2)}
            />
          </div>

          <div className="space-y-3">
            {giocate.map((g) => (
              <GiornataCard
                key={g.numero}
                giornata={g}
                aperta={overrides[g.numero] ?? g.numero === ultima}
                onToggle={() =>
                  setOverrides((o) => ({
                    ...o,
                    [g.numero]: !(o[g.numero] ?? g.numero === ultima),
                  }))
                }
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function percentuale(parte: number, totale: number): string {
  if (totale === 0) return '—'
  return `${Math.round((parte / totale) * 100)}%`
}

function StatCard({ label, valore, nota }: { label: string; valore: number | string; nota?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-2.5 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-lg font-bold text-white">{valore}</p>
      {nota && <p className="text-[10px] text-slate-500">{nota}</p>}
    </div>
  )
}

function GiornataCard({
  giornata,
  aperta,
  onToggle,
}: {
  giornata: GiornataStorico
  aperta: boolean
  onToggle: () => void
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <button
        onClick={onToggle}
        aria-expanded={aperta}
        className="flex w-full items-baseline justify-between gap-2 px-3 py-2.5 text-left active:bg-surface-2"
      >
        <span className="text-sm font-semibold text-white">Giornata {giornata.numero}</span>
        <span className="flex items-baseline gap-2">
          <span className="text-xs text-slate-400">
            {giornata.pronosticate === 0 ? (
              'non pronosticata'
            ) : (
              <>
                <span className="font-semibold text-accent">+{giornata.punti}</span> punti ·{' '}
                {giornata.pronosticate}/{giornata.righe.length}
              </>
            )}
          </span>
          <span className={`text-xs text-slate-500 transition-transform ${aperta ? 'rotate-180' : ''}`}>
            ▾
          </span>
        </span>
      </button>
      {aperta && (
        <div className="space-y-1.5 px-3 pb-3">
          {giornata.righe.map((r) => (
            <RigaPartitaView key={r.partita.id} riga={r} />
          ))}
        </div>
      )}
    </div>
  )
}

function RigaPartitaView({ riga }: { riga: RigaPartita }) {
  const { partita } = riga
  const reale = calcolaRisultati(partita.gol_casa!, partita.gol_trasferta!)
  const pronosticata = !!riga.mio1X2 && !!riga.mioOU

  return (
    <div className="rounded-lg border border-border bg-surface-2 px-2 py-1.5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="min-w-0 flex-1 truncate text-right text-slate-300">{partita.casa}</span>
        <span className="shrink-0 rounded bg-surface px-1.5 py-0.5 font-bold text-white">
          {partita.gol_casa}-{partita.gol_trasferta}
        </span>
        <span className="min-w-0 flex-1 truncate text-slate-300">{partita.trasferta}</span>
      </div>

      <div className="mt-1.5 flex items-center justify-between gap-2">
        {pronosticata ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <EsitoPill label="1X2" scelta={riga.mio1X2!} reale={reale.risultato1X2} esatto={riga.esatto1X2} />
            <EsitoPill label="MG 1-2" scelta={riga.mioOU!} reale={reale.risultatoOU} esatto={riga.esattoOU} />
          </div>
        ) : (
          <span className="text-[11px] text-slate-500">Non pronosticata</span>
        )}
        {pronosticata && (
          <span
            className={`shrink-0 text-[11px] font-semibold ${riga.punti > 0 ? 'text-accent' : 'text-slate-500'}`}
          >
            +{riga.punti}
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * Scelta fatta ed esito reale: in verde se azzeccata, in rosso con accanto il
 * risultato giusto se sbagliata.
 */
function EsitoPill({
  label,
  scelta,
  reale,
  esatto,
}: {
  label: string
  scelta: string
  reale: string
  esatto: boolean
}) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px]',
        esatto
          ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-200'
          : 'border-rose-500/60 bg-rose-500/15 text-rose-200',
      ].join(' ')}
    >
      <span className="text-[9px] uppercase tracking-wide opacity-70">{label}</span>
      <span className="font-semibold">{scelta}</span>
      {!esatto && <span className="opacity-70">→ {reale}</span>}
    </span>
  )
}
