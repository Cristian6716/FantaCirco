import { useAsteWindow } from '../lib/queries'
import { Countdown } from './ui'
import { formatDateTime } from '../lib/format'

/** Banner con il conto alla rovescia verso la chiusura degli avvii di nuove aste. */
export function AsteWindowBanner({ className }: { className?: string }) {
  const { deadline, closed } = useAsteWindow()
  if (!deadline) return null

  if (closed) {
    return (
      <div className={`rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 ${className ?? ''}`}>
        <p className="text-sm font-semibold text-rose-200">🔒 Avvio nuove aste chiuso</p>
        <p className="mt-0.5 text-xs text-rose-200/80">
          Dalle {formatDateTime(deadline)} non si possono più aprire aste. Quelle in corso
          proseguono normalmente.
        </p>
      </div>
    )
  }

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 ${className ?? ''}`}
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-amber-200">⏳ Ultime aste</p>
        <p className="mt-0.5 text-xs text-amber-200/80">
          Si possono avviare nuove aste fino alle {formatDateTime(deadline)}.
        </p>
      </div>
      <Countdown
        target={deadline}
        className="shrink-0 rounded-lg border border-amber-500/40 bg-amber-500/15 px-2.5 py-1 font-mono text-sm font-bold tabular-nums text-amber-100"
      />
    </div>
  )
}
