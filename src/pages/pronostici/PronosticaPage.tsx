import { useMemo, useState } from 'react'
import {
  giornataChiusa,
  useGiornate,
  useOraCorrente,
  usePartite,
  usePronostici,
  useSavePronostici,
} from '../../lib/leagueQueries'
import { countdown, formatDateTime } from '../../lib/format'
import { EmptyState, PageLoader, Spinner } from '../../components/ui'
import { useToast } from '../../components/Toast'
import { useAuth } from '../../auth/AuthProvider'
import { GiornataPicker, PartitaCard } from './shared'

export default function PronosticaPage() {
  const { manager } = useAuth()
  const { data: giornate, isLoading: gLoading } = useGiornate()
  const { data: partite, isLoading: pLoading } = usePartite()
  const { data: pronostici } = usePronostici()
  const toast = useToast()
  const save = useSavePronostici()

  // Giornata corrente: la prima aperta, altrimenti l'ultima disponibile.
  const defaultGiornata = useMemo(() => {
    if (!giornate || giornate.length === 0) return null
    const aperta = giornate.find((g) => !giornataChiusa(g))
    return (aperta ?? giornate[giornate.length - 1]).numero
  }, [giornate])

  const [selected, setSelected] = useState<number | null>(null)
  const current = selected ?? defaultGiornata

  // Stato locale delle scelte: partita_id -> { p1x2, pou }.
  const [choices, setChoices] = useState<Record<string, { p1x2?: string; pou?: string }>>({})

  const giornataInfo = giornate?.find((g) => g.numero === current)
  // La deadline scatta da sola: `ora` avanza mentre si avvicina l'orario, così
  // il form passa in sola lettura senza bisogno di ricaricare.
  const ora = useOraCorrente(giornataInfo?.chiusura_at)
  const chiusa = giornataChiusa(giornataInfo, ora)
  const deadline = !chiusa && giornataInfo?.chiusura_at ? giornataInfo.chiusura_at : null

  const partiteGiornata = useMemo(
    () => (partite ?? []).filter((p) => p.giornata === current).sort((a, b) => a.ordine - b.ordine),
    [partite, current],
  )

  const myPronosticiMap = useMemo(() => {
    const map = new Map<string, { pronostico_1x2: string; pronostico_ou: string }>()
    for (const p of pronostici ?? []) {
      if (p.manager_id === manager?.id) map.set(p.partita_id, p)
    }
    return map
  }, [pronostici, manager])

  function choiceFor(partitaId: string): { p1x2?: string; pou?: string } {
    if (choices[partitaId]) return choices[partitaId]
    const existing = myPronosticiMap.get(partitaId)
    return existing ? { p1x2: existing.pronostico_1x2, pou: existing.pronostico_ou } : {}
  }

  function setChoice(partitaId: string, patch: { p1x2?: string; pou?: string }) {
    setChoices((prev) => {
      const existing = myPronosticiMap.get(partitaId)
      const base =
        prev[partitaId] ??
        (existing ? { p1x2: existing.pronostico_1x2, pou: existing.pronostico_ou } : {})
      return { ...prev, [partitaId]: { ...base, ...patch } }
    })
  }

  async function onSave() {
    if (current == null) return
    const items = partiteGiornata
      .map((p) => {
        const c = choiceFor(p.id)
        if (!c.p1x2 || !c.pou) return null
        return { partita_id: p.id, giornata: current, pronostico_1x2: c.p1x2, pronostico_ou: c.pou }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
    if (items.length === 0) {
      toast.error('Compila almeno una partita')
      return
    }
    try {
      await save.mutateAsync(items)
      setChoices({})
      toast.success('Pronostici salvati')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  if (gLoading || pLoading) return <PageLoader />

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-white">Pronostica</h1>

      {current == null ? (
        <EmptyState icon="📅" title="Nessuna giornata" />
      ) : (
        <div className="space-y-3">
          <GiornataPicker
            giornate={(giornate ?? []).map((g) => g.numero)}
            current={current}
            onChange={(n) => {
              setSelected(n)
              setChoices({})
            }}
          />

          {chiusa ? (
            <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              🔒 Pronostici chiusi per questa giornata. Vedi qui sotto i risultati e i tuoi punti.
            </p>
          ) : deadline ? (
            <p className="rounded-lg border border-accent-strong/40 bg-accent-strong/10 px-3 py-2 text-xs text-slate-200">
              ⏳ Chiusura automatica il {formatDateTime(deadline)} — manca{' '}
              <span className="font-semibold tabular-nums">{countdown(deadline, ora)}</span>. Puoi
              modificare i pronostici fino a quel momento.
            </p>
          ) : (
            <p className="text-xs text-slate-400">
              Scegli 1X2 e Multigol 1-2 per ogni partita. Puoi modificare finché la giornata è aperta.
            </p>
          )}

          <div className="space-y-2">
            {partiteGiornata.map((p) => (
              <PartitaCard
                key={p.id}
                partita={p}
                choice={choiceFor(p.id)}
                readOnly={chiusa}
                onChange={(patch) => setChoice(p.id, patch)}
              />
            ))}
          </div>

          {!chiusa && (
            <button
              onClick={onSave}
              disabled={save.isPending}
              className="sticky bottom-2 flex w-full items-center justify-center gap-2 rounded-xl bg-accent-strong py-3 text-sm font-semibold text-white shadow-lg disabled:opacity-50"
            >
              {save.isPending ? (
                <Spinner />
              ) : (
                `Salva pronostici (${
                  partiteGiornata.filter((p) => {
                    const c = choiceFor(p.id)
                    return c.p1x2 && c.pou
                  }).length
                }/${partiteGiornata.length})`
              )}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
