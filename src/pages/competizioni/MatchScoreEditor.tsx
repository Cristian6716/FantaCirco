import { useEffect, useState } from 'react'
import { useAdminSetPunteggio } from '../../lib/leagueQueries'
import { useToast } from '../../components/Toast'

/**
 * Editor admin: due input con il punteggio fanta delle squadre per la giornata
 * reale del match. Salva su blur (stessa tabella punteggi_giornata del tab
 * Giornate dell'admin, quindi i risultati restano coerenti ovunque).
 */
export default function MatchScoreEditor({
  giornata,
  managerA,
  managerB,
  scoreA,
  scoreB,
}: {
  giornata: number | null
  managerA: string
  managerB: string
  scoreA: number | null
  scoreB: number | null
}) {
  if (giornata == null) {
    return <p className="mt-1 text-[10px] text-amber-400">Assegna prima la giornata reale (Admin → Megagalattico)</p>
  }
  return (
    <div className="mt-1.5 grid grid-cols-2 gap-1.5">
      <ScoreInput giornata={giornata} managerId={managerA} value={scoreA} />
      <ScoreInput giornata={giornata} managerId={managerB} value={scoreB} />
    </div>
  )
}

function ScoreInput({ giornata, managerId, value }: { giornata: number; managerId: string; value: number | null }) {
  const toast = useToast()
  const setPunteggio = useAdminSetPunteggio()
  const [text, setText] = useState(value != null ? String(value) : '')

  useEffect(() => {
    setText(value != null ? String(value) : '')
  }, [value])

  function save() {
    const raw = text.replace(',', '.').trim()
    const val = raw === '' ? null : Number(raw)
    if (val !== null && !Number.isFinite(val)) {
      toast.error('Punteggio non valido')
      return
    }
    if (val === value) return
    setPunteggio.mutate(
      { giornata, manager_id: managerId, punteggio: val },
      { onError: (e) => toast.error(e instanceof Error ? e.message : 'Errore') },
    )
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      value={text}
      placeholder="Punti"
      onChange={(e) => setText(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      className="h-8 w-full rounded-lg border border-border bg-surface-2 text-center text-sm text-white outline-none focus:border-accent"
    />
  )
}
