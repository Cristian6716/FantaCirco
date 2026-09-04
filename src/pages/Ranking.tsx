import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../auth/AuthProvider'
import { useRanking, type RankingRow } from '../lib/rankingQueries'
import { useMegaData } from '../lib/megaData'
import { useMegaTurni } from '../lib/megagalattico'
import { buildRankingTorneo } from '../lib/rankingTorneo'
import { EmptyState, PageLoader } from '../components/ui'

export default function RankingPage() {
  const { data: rows, isLoading } = useRanking()
  const { manager } = useAuth()
  const [open, setOpen] = useState<Set<string>>(new Set())

  // Punti maturati nella stagione in corso: vengono solo dal torneo, e restano
  // a zero finché non si gioca il primo turno.
  const { teamNameById, allIds, swiss, classificaA, classificaB } = useMegaData()
  const { data: megaTurni } = useMegaTurni()

  const puntiStagione = useMemo(() => {
    const righe = buildRankingTorneo(swiss?.matches ?? [], classificaA, classificaB, allIds)
    const perManager = new Map<string, number>()
    const perSquadra = new Map<string, number>()
    for (const r of righe) {
      perManager.set(r.managerId, r.totale)
      const team = teamNameById.get(r.managerId)
      if (team) perSquadra.set(team, r.totale)
    }
    return { perManager, perSquadra }
  }, [swiss, classificaA, classificaB, allIds, teamNameById])

  // Le squadre dello scorso anno senza manager attuale non hanno punti nuovi:
  // il join passa dal manager e ripiega sul nome squadra.
  const puntiDi = (row: RankingRow): number =>
    (row.manager_id ? puntiStagione.perManager.get(row.manager_id) : undefined) ??
    puntiStagione.perSquadra.get(row.team_name) ??
    0

  // Prima giornata reale del torneo: è da lì che parte il punteggio nuovo.
  const primaGiornataTorneo = useMemo(() => {
    const giornate = (megaTurni ?? [])
      .map((t) => t.giornata_reale)
      .filter((g): g is number => g != null)
    return giornate.length > 0 ? Math.min(...giornate) : null
  }, [megaTurni])

  const stagioneIniziata = [...puntiStagione.perManager.values()].some((p) => p > 0)

  function toggle(team: string) {
    setOpen((o) => {
      const next = new Set(o)
      if (next.has(team)) next.delete(team)
      else next.add(team)
      return next
    })
  }

  const [rulesOpen, setRulesOpen] = useState(false)

  if (isLoading) return <PageLoader />
  if (!rows || rows.length === 0)
    return (
      <EmptyState icon="🏆" title="Nessun ranking" hint="Il ranking generale non è ancora stato calcolato." />
    )

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-bold text-white">Ranking</h1>
        <button
          type="button"
          onClick={() => setRulesOpen(true)}
          aria-label="Regole di calcolo del ranking"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-surface-2 text-xs font-bold text-slate-300 active:scale-95"
        >
          !
        </button>
      </div>
      <p className="text-xs text-slate-400">
        Ranking totale: Campionato, Battle Royale e Torneo dello scorso anno pesati insieme. Tocca
        una riga per vedere come sono stati ottenuti i punti.
      </p>
      {rulesOpen && <RulesModal onClose={() => setRulesOpen(false)} />}

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[24rem] text-sm">
          <thead>
            <tr className="bg-surface-2 text-xs uppercase tracking-wide text-slate-400">
              <th className="px-2 py-2 text-left font-medium">#</th>
              <th className="px-2 py-2 text-left font-medium">Squadra</th>
              <th className="px-2 py-2 text-center font-medium">In corso</th>
              <th className="px-2 py-2 text-right font-medium">Totale</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isMe = !!manager?.team_name && r.team_name === manager.team_name
              const expanded = open.has(r.team_name)
              return (
                <RankingRowGroup
                  key={r.team_name}
                  row={r}
                  puntiStagione={puntiDi(r)}
                  isMe={isMe}
                  expanded={expanded}
                  onToggle={() => toggle(r.team_name)}
                />
              )
            })}
          </tbody>
        </table>
      </div>

      {!stagioneIniziata && (
        <p className="rounded-lg border border-border bg-surface px-3 py-2 text-[11px] leading-relaxed text-slate-400">
          La colonna <span className="font-semibold text-slate-200">In corso</span> è ancora a zero
          per tutti: i primi punti di questa stagione arrivano dal primo turno di coppa
          {primaGiornataTorneo != null ? `, alla ${primaGiornataTorneo}ª giornata` : ''}. Non entrano
          nel totale, che resta quello dello scorso anno.
        </p>
      )}
    </div>
  )
}

function RankingRowGroup({
  row,
  puntiStagione,
  isMe,
  expanded,
  onToggle,
}: {
  row: RankingRow
  puntiStagione: number
  isMe: boolean
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className={`cursor-pointer border-t border-border active:bg-surface-2 ${isMe ? 'bg-accent/10' : 'bg-surface'}`}
      >
        <td className="px-2 py-2 align-top text-slate-400">{row.pos}</td>
        <td className="px-2 py-2 align-top">
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-white">{row.team_name}</span>
            {row.torneo_campione && (
              <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
                🏆 campione torneo
              </span>
            )}
            <span className={`ml-auto text-xs text-slate-500 transition-transform ${expanded ? 'rotate-180' : ''}`}>
              ▾
            </span>
          </div>
          {row.manager_name && <p className="text-xs text-slate-500">{row.manager_name}</p>}
        </td>
        <td
          className={`px-2 py-2 text-center align-top tabular-nums ${
            puntiStagione > 0 ? 'font-semibold text-accent' : 'text-slate-500'
          }`}
        >
          {puntiStagione > 0 ? `+${puntiStagione}` : '—'}
        </td>
        <td className="px-2 py-2 text-right align-top font-bold text-accent">{row.totale}</td>
      </tr>
      {expanded && (
        <tr className={`border-t border-border ${isMe ? 'bg-accent/5' : 'bg-surface-2'}`}>
          <td colSpan={4} className="px-3 py-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <BreakdownCard label="Campionato" pos={row.campionato_pos} pts={row.campionato_pts} />
              <BreakdownCard label="Battle Royale" pos={row.royale_pos} pts={row.royale_pts} />
              <div className="rounded-lg border border-border bg-surface p-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Torneo</p>
                <p className="mt-0.5 text-lg font-bold text-white">{row.torneo_pts} pt</p>
                <p className="mt-1 text-xs leading-snug text-slate-400">{row.torneo_detail}</p>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function BreakdownCard({ label, pos, pts }: { label: string; pos: number; pts: number }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-lg font-bold text-white">{pts} pt</p>
      <p className="mt-1 text-xs text-slate-400">{pos}° posizione</p>
    </div>
  )
}

/** Guscio comune delle modali regole: overlay, sheet su mobile, chiusura. */
function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-border bg-surface p-5 pb-safe sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Chiudi"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-surface-2 text-slate-300"
          >
            ✕
          </button>
        </div>

        {children}

        <button
          onClick={onClose}
          className="mt-5 w-full rounded-xl border border-border bg-surface-2 py-2.5 text-sm font-medium text-slate-200"
        >
          Chiudi
        </button>
      </div>
    </div>,
    document.body,
  )
}

function RulesModal({ onClose }: { onClose: () => void }) {
  return (
    <ModalShell title="Come si calcola il ranking" onClose={onClose}>

        <p className="mt-3 text-xs text-slate-400">
          Il ranking generale dello scorso anno somma i punti ottenuti in Campionato, Battle Royale e Torneo.
        </p>

        <div className="mt-4 space-y-4 text-sm text-slate-300">
          <div>
            <p className="font-semibold text-white">Campionato</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              Punti = (17 − posizione finale) × 10. Il 1° prende 160 pt, il 16° prende 10 pt.
            </p>
          </div>

          <div>
            <p className="font-semibold text-white">Battle Royale</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              Punti = (17 − posizione finale) × 5. Il 1° prende 80 pt, il 16° prende 5 pt.
            </p>
          </div>

          <div>
            <p className="font-semibold text-white">Torneo</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              <span className="font-medium text-slate-300">Girone</span> (4 gironi da 4 squadre): 1° posto 8 pt, 2°
              posto 6 pt, 3° posto 4 pt, ultimo 2 pt.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              <span className="font-medium text-slate-300">Fase a eliminazione diretta</span> (3 bracket — upper, mid,
              lower): ogni vittoria vale 4 pt in upper, 2 pt in mid, 1 pt in lower. L'Upper Final vale 4 pt, la Lower
              Final vale 2 pt, la Semifinale e la Finale valgono 4 pt ciascuna. Il totale delle vittorie della fase a
              eliminazione viene poi <span className="font-medium text-slate-300">moltiplicato per 3</span>.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              Punti Torneo = punti girone + (punti fase eliminazione × 3).
            </p>
          </div>

          <div className="rounded-lg border border-border bg-surface-2 p-2.5">
            <p className="text-xs font-semibold text-white">Totale</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              Totale = punti Campionato + punti Battle Royale + punti Torneo. Il ranking è ordinato per totale
              decrescente.
            </p>
          </div>

          <div>
            <p className="font-semibold text-white">Colonna &quot;In corso&quot;</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              Punti maturati in questa stagione, che arrivano dal torneo con il format nuovo. Nello{' '}
              <span className="font-medium text-slate-300">svizzero</span> ogni vittoria vale in base al record V-P
              che il vincitore aveva prima della partita: 5 pt a 2-0, 3 pt a 1-0 e 2-1, 2 pt con record pari (0-0,
              1-1, 2-2), 1 pt con record negativo (0-1, 1-2, 0-2). Nei{' '}
              <span className="font-medium text-slate-300">gironi</span> il Girone A dà 4 pt a vittoria e 2 a
              pareggio, il Girone B 2 e 1. I punti della fase a eliminazione non sono ancora stati decisi.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              Sono tenuti separati dal totale: quello resta il ranking chiuso dello scorso anno.
            </p>
          </div>
        </div>

    </ModalShell>
  )
}
