import { useMemo, useState } from 'react'
import { useManagers } from '../../lib/queries'
import { useMyPodioVote, useOpenPodioRound, useSubmitPodioVote, type PodioVote } from '../../lib/podio'
import { EmptyState, PageLoader, Spinner } from '../../components/ui'
import { useToast } from '../../components/Toast'

export default function PodioPage() {
  const round = useOpenPodioRound()
  const { data: managers, isLoading: mLoading } = useManagers()
  const { data: myVote, isLoading: vLoading } = useMyPodioVote(round?.id)
  const [editing, setEditing] = useState(false)

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

  const showForm = !!round && (!myVote || editing)

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-white">Podio</h1>

      {!round ? (
        <EmptyState
          icon="🏆"
          title="Nessuna votazione podio in corso"
          hint="Quando l'admin apre una votazione potrai scegliere il tuo podio qui."
        />
      ) : showForm ? (
        <PodioVoteForm
          key={`${round.id}-${myVote ? 'edit' : 'new'}`}
          roundId={round.id}
          squadre={squadre}
          initial={myVote ?? null}
          onCancel={myVote ? () => setEditing(false) : undefined}
          onSaved={() => setEditing(false)}
        />
      ) : (
        myVote && (
          <div className="rounded-2xl border border-accent/40 bg-accent/10 p-4">
            <p className="text-sm font-semibold text-accent">Hai votato</p>
            <div className="mt-3 space-y-1.5 text-sm text-white">
              <p>🥇 1° {nameOf(myVote.pos1)}</p>
              <p>🥈 2° {nameOf(myVote.pos2)}</p>
              <p>🥉 3° {nameOf(myVote.pos3)}</p>
            </div>
            <button
              onClick={() => setEditing(true)}
              className="mt-4 w-full rounded-xl border border-border bg-surface-2 py-2.5 text-sm font-medium text-slate-200 active:scale-[0.98]"
            >
              Modifica voto
            </button>
          </div>
        )
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

  async function onSave() {
    if (!pos1 || !pos2 || !pos3) return
    try {
      await submit.mutateAsync({ round_id: roundId, pos1, pos2, pos3 })
      toast.success('Voto registrato')
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-400">
        Scegli le squadre per 1°, 2° e 3° posto tra le {squadre.length} in gara.
      </p>
      <PosSelect label="1° posto" value={pos1} onChange={setPos1} options={squadre} exclude={[pos2, pos3]} />
      <PosSelect label="2° posto" value={pos2} onChange={setPos2} options={squadre} exclude={[pos1, pos3]} />
      <PosSelect label="3° posto" value={pos3} onChange={setPos3} options={squadre} exclude={[pos1, pos2]} />
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
          disabled={!pos1 || !pos2 || !pos3 || submit.isPending}
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
