import { useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useClaimTeam, useManagers } from '../lib/queries'
import { Spinner } from '../components/ui'
import { TEAM_NAMES } from '../lib/teams'

export default function ChooseTeamPage() {
  const { refreshManager, signOut } = useAuth()
  const { data: managers, isLoading } = useManagers()
  const claimTeam = useClaimTeam()
  const [selected, setSelected] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const taken = useMemo(
    () => new Set((managers ?? []).map((m) => m.team_name).filter((t): t is string => !!t)),
    [managers],
  )

  async function onConfirm() {
    if (!selected) return
    setError(null)
    try {
      await claimTeam.mutateAsync(selected)
      await refreshManager()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore')
    }
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col px-5 pt-safe pb-safe">
      <div className="pt-10 pb-6 text-center">
        <div className="text-5xl">🎪</div>
        <h1 className="mt-3 text-2xl font-bold text-white">Scegli la tua squadra</h1>
        <p className="mt-2 text-sm text-slate-400">
          Attenzione: la scelta è <b>definitiva</b>, non potrai più cambiarla.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {TEAM_NAMES.map((name) => {
            const isTaken = taken.has(name)
            const isSelected = selected === name
            return (
              <button
                key={name}
                onClick={() => !isTaken && setSelected(name)}
                disabled={isTaken || claimTeam.isPending}
                className={[
                  'flex min-h-[3.5rem] items-center justify-center rounded-xl border px-3 py-2 text-center text-sm font-semibold transition active:scale-[0.97] disabled:active:scale-100',
                  isTaken
                    ? 'border-border bg-surface-2 text-slate-600 line-through opacity-60'
                    : isSelected
                      ? 'border-accent bg-accent/15 text-accent'
                      : 'border-border bg-surface text-white',
                ].join(' ')}
              >
                {name}
              </button>
            )
          })}
        </div>
      )}

      {error && (
        <p className="mt-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-center text-sm text-rose-200">
          {error}
        </p>
      )}

      <button
        onClick={onConfirm}
        disabled={!selected || claimTeam.isPending}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-accent-strong py-3 font-semibold text-white active:scale-[0.98] disabled:opacity-50"
      >
        {claimTeam.isPending ? <Spinner /> : selected ? `Conferma «${selected}»` : 'Scegli una squadra'}
      </button>

      <button
        onClick={() => void signOut()}
        className="mt-4 pb-4 text-center text-xs text-slate-500 underline-offset-2 hover:underline"
      >
        Esci
      </button>
    </div>
  )
}
