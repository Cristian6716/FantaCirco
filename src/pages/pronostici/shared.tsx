import type { Partita } from '../../lib/leagueQueries'
import { calcolaRisultati, ouOptions, puntiPronostico } from '../../lib/pronostici'

export function GiornataPicker({
  giornate,
  current,
  onChange,
}: {
  giornate: number[]
  current: number
  onChange: (n: number) => void
}) {
  const idx = giornate.indexOf(current)
  const prev = idx > 0 ? giornate[idx - 1] : null
  const next = idx >= 0 && idx < giornate.length - 1 ? giornate[idx + 1] : null
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-surface px-2 py-1.5">
      <button
        onClick={() => prev != null && onChange(prev)}
        disabled={prev == null}
        className="h-9 w-9 rounded-lg text-lg text-slate-300 disabled:opacity-30"
      >
        ‹
      </button>
      <span className="text-sm font-semibold text-white">Giornata {current}</span>
      <button
        onClick={() => next != null && onChange(next)}
        disabled={next == null}
        className="h-9 w-9 rounded-lg text-lg text-slate-300 disabled:opacity-30"
      >
        ›
      </button>
    </div>
  )
}

export function PartitaCard({
  partita,
  choice,
  readOnly,
  onChange,
}: {
  partita: Partita
  choice: { p1x2?: string; pou?: string }
  readOnly: boolean
  onChange: (patch: { p1x2?: string; pou?: string }) => void
}) {
  const hasResult = partita.gol_casa !== null && partita.gol_trasferta !== null
  const result = hasResult ? calcolaRisultati(partita.gol_casa!, partita.gol_trasferta!) : null
  const punti =
    choice.p1x2 && choice.pou
      ? puntiPronostico(
          { pronostico_1x2: choice.p1x2, pronostico_ou: choice.pou },
          partita.gol_casa,
          partita.gol_trasferta,
        )
      : null

  const ou = ouOptions()

  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="min-w-0 flex-1 truncate text-right font-medium text-white">{partita.casa}</span>
        <span className="shrink-0 rounded-md bg-surface-2 px-2 py-0.5 text-xs font-bold text-slate-200">
          {hasResult ? `${partita.gol_casa}-${partita.gol_trasferta}` : 'vs'}
        </span>
        <span className="min-w-0 flex-1 truncate font-medium text-white">{partita.trasferta}</span>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {(['1', 'X', '2'] as const).map((v) => (
          <Chip
            key={v}
            label={v}
            active={choice.p1x2 === v}
            correct={result ? result.risultato1X2 === v : undefined}
            picked={choice.p1x2 === v}
            disabled={readOnly}
            onClick={() => onChange({ p1x2: v })}
          />
        ))}
      </div>

      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
        {ou.map((v) => (
          <Chip
            key={v}
            label={v}
            active={choice.pou === v}
            correct={result ? result.risultatoOU === v : undefined}
            picked={choice.pou === v}
            disabled={readOnly}
            onClick={() => onChange({ pou: v })}
          />
        ))}
      </div>

      {punti && hasResult && (
        <p className="mt-2 text-right text-xs font-semibold text-accent">
          +{punti.punti1X2 + punti.puntiOU} punti
        </p>
      )}
    </div>
  )
}

export function Chip({
  label,
  active,
  correct,
  picked,
  disabled,
  onClick,
}: {
  label: string
  active: boolean
  correct?: boolean
  picked: boolean
  disabled?: boolean
  onClick: () => void
}) {
  // Colore: se c'è un esito (correct definito), evidenzia verde il giusto e
  // rosso la scelta sbagliata; altrimenti stile "selezionato" neutro.
  let cls = 'border-border bg-surface-2 text-slate-300'
  if (correct === true) cls = 'border-emerald-500/60 bg-emerald-500/15 text-emerald-200'
  else if (picked && correct === false) cls = 'border-rose-500/60 bg-rose-500/15 text-rose-200'
  else if (active) cls = 'border-accent/60 bg-accent/15 text-accent'
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg border py-2 text-sm font-semibold transition-colors disabled:opacity-100 ${cls} ${
        picked ? 'ring-1 ring-inset ring-white/20' : ''
      }`}
    >
      {label}
    </button>
  )
}

