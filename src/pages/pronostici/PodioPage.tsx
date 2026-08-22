import { useMemo, useState } from 'react'
import { useManagers } from '../../lib/queries'
import {
  podioRoundChiuso,
  useLatestPodioRound,
  useMyPodioVote,
  usePodioClassifica,
  useSubmitPodioVote,
  type PodioClassificaRow,
  type PodioVote,
} from '../../lib/podio'
import { useOraCorrente } from '../../lib/leagueQueries'
import { countdown, formatDateTime } from '../../lib/format'
import { EmptyState, PageLoader, Spinner } from '../../components/ui'
import { useToast } from '../../components/Toast'

export default function PodioPage() {
  const round = useLatestPodioRound()
  const { data: managers, isLoading: mLoading } = useManagers()
  const { data: myVote, isLoading: vLoading } = useMyPodioVote(round?.id)
  const [editing, setEditing] = useState(false)
  // A deadline scaduta la pagina passa da sola ai risultati, senza ricaricare.
  const ora = useOraCorrente(round?.chiusura_at)
  const chiuso = podioRoundChiuso(round, ora)
  // La classifica si sblocca dopo aver votato, o a votazione chiusa per tutti.
  const { data: classifica } = usePodioClassifica(round?.id, chiuso || !!myVote)

  const squadre = useMemo(
    () =>
      (managers ?? [])
        .filter((m) => !!m.team_name)
        .sort((a, b) => (a.team_name || a.display_name).localeCompare(b.team_name || b.display_name)),
    [managers],
  )
  const nameOf = (id: string) => {
    const m = squadre.find((s) => s.id === id)
    return m ? m.team_name || m.display_name : '—'
  }

  if (mLoading || vLoading) return <PageLoader />

  const showForm = !!round && !chiuso && (!myVote || editing)
  const deadline = !chiuso && round?.chiusura_at ? round.chiusura_at : null

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-white">Podio</h1>

      {!round ? (
        <EmptyState
          icon="🏆"
          title="Nessuna votazione podio in corso"
          hint="Quando l'admin apre una votazione potrai scegliere il tuo podio qui."
        />
      ) : chiuso ? (
        <>
          <PodioFinale rows={classifica} />
          {myVote && <IlTuoVoto vote={myVote} nameOf={nameOf} />}
          <ClassificaPodio rows={classifica} />
        </>
      ) : showForm ? (
        <>
          {deadline && <BannerDeadline deadline={deadline} ora={ora} />}
          <PodioVoteForm
            key={`${round.id}-${myVote ? 'edit' : 'new'}`}
            roundId={round.id}
            squadre={squadre}
            initial={myVote ?? null}
            onCancel={myVote ? () => setEditing(false) : undefined}
            onSaved={() => setEditing(false)}
          />
        </>
      ) : (
        myVote && (
          <>
            {deadline && <BannerDeadline deadline={deadline} ora={ora} />}
            <IlTuoVoto vote={myVote} nameOf={nameOf} onEdit={() => setEditing(true)} />
            <ClassificaPodio rows={classifica} />
          </>
        )
      )}
    </div>
  )
}

// Banner con la deadline di chiusura automatica e il conto alla rovescia.
function BannerDeadline({ deadline, ora }: { deadline: string; ora: number }) {
  return (
    <p className="rounded-lg border border-accent-strong/40 bg-accent-strong/10 px-3 py-2 text-xs text-slate-200">
      ⏳ Le votazioni si chiudono il {formatDateTime(deadline)} — manca{' '}
      <span className="font-semibold tabular-nums">{countdown(deadline, ora)}</span>. Dopo vedrai il
      podio più votato.
    </p>
  )
}

function IlTuoVoto({
  vote,
  nameOf,
  onEdit,
}: {
  vote: PodioVote
  nameOf: (id: string) => string
  onEdit?: () => void
}) {
  return (
    <div className="rounded-2xl border border-accent/40 bg-accent/10 p-4">
      <p className="text-sm font-semibold text-accent">{onEdit ? 'Hai votato' : 'Il tuo voto'}</p>
      <div className="mt-3 space-y-1.5 text-sm text-white">
        <p>🥇 1° {nameOf(vote.pos1)}</p>
        <p>🥈 2° {nameOf(vote.pos2)}</p>
        <p>🥉 3° {nameOf(vote.pos3)}</p>
        <p>🔻 Ultimo {vote.ultimo ? nameOf(vote.ultimo) : '—'}</p>
      </div>
      {onEdit && (
        <button
          onClick={onEdit}
          className="mt-4 w-full rounded-xl border border-border bg-surface-2 py-2.5 text-sm font-medium text-slate-200 active:scale-[0.98]"
        >
          Modifica voto
        </button>
      )}
    </div>
  )
}

// ---------------- Podio finale ----------------

// Aspetto dei tre gradini: oro al centro (più alto), argento a sinistra,
// bronzo a destra, come su un podio vero.
const GRADINI = [
  { pos: 2, altezza: 'h-24', gradiente: 'from-slate-200 to-slate-400', medaglia: '🥈' },
  { pos: 1, altezza: 'h-32', gradiente: 'from-amber-200 to-amber-400', medaglia: '🥇' },
  { pos: 3, altezza: 'h-20', gradiente: 'from-orange-300 to-orange-600', medaglia: '🥉' },
] as const

/**
 * Grafica del podio più votato, visibile a votazione chiusa: le tre squadre
 * con più punti (3 per un 1° posto, 2 per un 2°, 1 per un 3°).
 */
export function PodioFinale({ rows }: { rows: PodioClassificaRow[] | undefined }) {
  const votanti = rows ? rows.reduce((n, r) => n + r.c1, 0) : 0
  const top3 = (rows ?? []).slice(0, 3)
  const ultimo = useMemo(() => {
    const candidati = (rows ?? []).filter((r) => r.cu > 0)
    return candidati.length > 0
      ? candidati.reduce((best, r) => (r.cu > best.cu ? r : best))
      : null
  }, [rows])

  if (votanti === 0 || top3.length < 3) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-4 text-center">
        <p className="text-sm font-semibold text-white">🏆 Votazione chiusa</p>
        <p className="mt-1 text-xs text-slate-400">Non ci sono abbastanza voti per un podio.</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-linear-to-b from-surface-2 to-surface p-4">
      <div className="text-center">
        <h2 className="text-base font-bold text-white">🏆 Il podio più votato</h2>
        <p className="mt-0.5 text-xs text-slate-400">
          Votazione chiusa · {votanti} {votanti === 1 ? 'voto' : 'voti'}
        </p>
      </div>

      <div className="mt-5 flex items-end justify-center gap-1.5 sm:gap-3">
        {GRADINI.map(({ pos, altezza, gradiente, medaglia }) => {
          const row = top3[pos - 1]
          return (
            <div key={pos} className="flex min-w-0 flex-1 flex-col items-center">
              <p className="mb-1.5 line-clamp-3 w-full text-center text-[11px] font-bold leading-tight text-white sm:text-xs">
                {row.nome}
              </p>
              <div
                className={[
                  'flex w-full flex-col items-center justify-center rounded-t-lg bg-linear-to-b shadow-lg',
                  altezza,
                  gradiente,
                ].join(' ')}
              >
                <span className="text-3xl font-black leading-none text-slate-900 sm:text-4xl">
                  {pos}
                </span>
                <span className="mt-1 text-[10px] font-semibold text-slate-800/80">
                  {row.punti} pt
                </span>
              </div>
              <p className="w-full border-t-2 border-border/80 pt-1 text-center text-[10px] text-slate-400">
                {medaglia} {row.c1} × 1°
              </p>
            </div>
          )
        })}
      </div>

      {ultimo && (
        <p className="mt-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-center text-xs text-slate-200">
          🔻 Ultimo più votato: <span className="font-semibold text-white">{ultimo.nome}</span> ·{' '}
          {ultimo.cu} {ultimo.cu === 1 ? 'voto' : 'voti'}
        </p>
      )}
    </div>
  )
}

// Classifica aggregata: solo i totali, senza chi ha votato cosa.
function ClassificaPodio({ rows }: { rows: PodioClassificaRow[] | undefined }) {
  if (!rows) return null
  const votanti = rows.reduce((n, r) => n + r.c1, 0)

  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-200">Classifica</h3>
        <span className="text-xs text-slate-500">
          {votanti} {votanti === 1 ? 'voto' : 'voti'}
        </span>
      </div>
      {votanti === 0 ? (
        <p className="mt-2 text-xs text-slate-500">Nessun voto ancora.</p>
      ) : (
        <div className="mt-2 overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-2 text-xs uppercase tracking-wide text-slate-400">
                <th className="px-2 py-1.5 text-left font-medium">Squadra</th>
                <th className="px-2 py-1.5 text-center font-medium">1°</th>
                <th className="px-2 py-1.5 text-center font-medium">2°</th>
                <th className="px-2 py-1.5 text-center font-medium">3°</th>
                <th className="px-2 py-1.5 text-center font-medium">Ult.</th>
                <th className="px-2 py-1.5 text-right font-medium">Punti</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.managerId} className="border-t border-border bg-surface">
                  <td className="px-2 py-1.5 font-medium text-white">{r.nome}</td>
                  <td className="px-2 py-1.5 text-center text-slate-300">{r.c1}</td>
                  <td className="px-2 py-1.5 text-center text-slate-300">{r.c2}</td>
                  <td className="px-2 py-1.5 text-center text-slate-300">{r.c3}</td>
                  <td className="px-2 py-1.5 text-center text-slate-400">{r.cu}</td>
                  <td className="px-2 py-1.5 text-right font-bold text-accent">{r.punti}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function PodioVoteForm({
  roundId,
  squadre,
  initial,
  onCancel,
  onSaved,
}: {
  roundId: number
  squadre: { id: string; team_name: string | null; display_name: string }[]
  initial: PodioVote | null
  onCancel?: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const submit = useSubmitPodioVote()
  const [pos1, setPos1] = useState(initial?.pos1 ?? '')
  const [pos2, setPos2] = useState(initial?.pos2 ?? '')
  const [pos3, setPos3] = useState(initial?.pos3 ?? '')
  const [ultimo, setUltimo] = useState(initial?.ultimo ?? '')

  async function onSave() {
    if (!pos1 || !pos2 || !pos3 || !ultimo) return
    try {
      await submit.mutateAsync({ round_id: roundId, pos1, pos2, pos3, ultimo })
      toast.success('Voto registrato')
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-400">
        Scegli le squadre per 1°, 2°, 3° e ultimo posto tra le {squadre.length} in gara.
      </p>
      <PosSelect label="1° posto" value={pos1} onChange={setPos1} options={squadre} exclude={[pos2, pos3, ultimo]} />
      <PosSelect label="2° posto" value={pos2} onChange={setPos2} options={squadre} exclude={[pos1, pos3, ultimo]} />
      <PosSelect label="3° posto" value={pos3} onChange={setPos3} options={squadre} exclude={[pos1, pos2, ultimo]} />
      <PosSelect
        label="Ultimo posto"
        value={ultimo}
        onChange={setUltimo}
        options={squadre}
        exclude={[pos1, pos2, pos3]}
      />
      <div className="flex gap-2">
        {onCancel && (
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border border-border bg-surface-2 py-2.5 text-sm text-slate-200"
          >
            Annulla
          </button>
        )}
        <button
          onClick={onSave}
          disabled={!pos1 || !pos2 || !pos3 || !ultimo || submit.isPending}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent-strong py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {submit.isPending ? <Spinner /> : 'Vota'}
        </button>
      </div>
    </div>
  )
}

function PosSelect({
  label,
  value,
  onChange,
  options,
  exclude,
}: {
  label: string
  value: string
  onChange: (id: string) => void
  options: { id: string; team_name: string | null; display_name: string }[]
  exclude: string[]
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <label className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-white outline-none focus:border-accent"
      >
        <option value="">— seleziona —</option>
        {options
          .filter((o) => !exclude.includes(o.id) || o.id === value)
          .map((o) => (
            <option key={o.id} value={o.id}>
              {o.team_name || o.display_name}
            </option>
          ))}
      </select>
    </div>
  )
}
