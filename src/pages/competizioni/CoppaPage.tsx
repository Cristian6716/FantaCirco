import { useMemo } from 'react'
import { useManagers } from '../../lib/queries'
import { buildGiornateScores, useOverrides, usePunteggiGiornata } from '../../lib/leagueQueries'
import { resolveTournament, type TorneoMatch, type TorneoOverrideInput } from '../../lib/tornei'
import { initialMatches } from '../../lib/torneoData'
import { PageLoader } from '../../components/ui'

export default function CoppaPage() {
  const { data: managers } = useManagers()
  const { data: punteggi } = usePunteggiGiornata()
  const { data: overrides } = useOverrides()

  const matchesByDay = useMemo(() => {
    if (!managers || !punteggi) return []
    const scores = buildGiornateScores(punteggi, managers)
    const ovr: Record<string, TorneoOverrideInput> = {}
    for (const o of overrides ?? [])
      ovr[o.match_id] = { winner: o.winner as 'A' | 'B', golA: o.gol_a, golB: o.gol_b }
    const resolved = resolveTournament(initialMatches, scores, ovr)
    const byDay = new Map<number, TorneoMatch[]>()
    for (const m of resolved) {
      if (!byDay.has(m.day)) byDay.set(m.day, [])
      byDay.get(m.day)!.push(m)
    }
    return Array.from(byDay.entries()).sort(([a], [b]) => a - b)
  }, [managers, punteggi, overrides])

  if (!managers || !punteggi) return <PageLoader />

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-white">Coppa</h1>
      <p className="text-xs text-slate-400">
        Il bracket avanza in automatico dai punteggi fanta di ogni giornata (stesse fasce della Battle Royale).
      </p>
      <div className="space-y-3">
        {matchesByDay.map(([day, matches]) => (
          <div key={day} className="rounded-xl border border-border bg-surface p-3">
            <p className="mb-2 text-sm font-semibold text-white">Giornata {day}</p>
            <div className="space-y-1.5">
              {matches.map((m) => (
                <MatchRow key={m.id} match={m} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function MatchRow({ match }: { match: TorneoMatch }) {
  const played = match.golA != null && match.golB != null
  const winA = match.winner === 'A'
  const winB = match.winner === 'B'

  function teamCls(isWinner: boolean, isPlaceholder: boolean) {
    if (isPlaceholder) return 'text-slate-500 italic'
    if (isWinner) return 'font-semibold text-emerald-300'
    if (played) return 'text-slate-400'
    return 'text-white'
  }

  const phA = match.teamA.startsWith('Vinc.') || match.teamA.startsWith('Perd.')
  const phB = match.teamB.startsWith('Vinc.') || match.teamB.startsWith('Perd.')

  return (
    <div className="rounded-lg border border-border bg-surface-2 px-2.5 py-1.5">
      {match.label && (
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
          {match.label}
        </p>
      )}
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className={`min-w-0 flex-1 truncate text-right ${teamCls(winA, phA)}`}>{match.teamA}</span>
        <span className="shrink-0 rounded bg-bg px-1.5 py-0.5 text-xs font-bold text-slate-200">
          {played ? `${match.golA}-${match.golB}` : '–'}
        </span>
        <span className={`min-w-0 flex-1 truncate ${teamCls(winB, phB)}`}>{match.teamB}</span>
      </div>
      {match.draw && !match.winner && (
        <p className="mt-1 text-center text-[10px] text-amber-300">Spareggio da assegnare (admin)</p>
      )}
      {match.eliminationMatch && match.eliminated && (
        <p className="mt-1 text-center text-[10px] text-rose-300">
          Eliminato: {match.eliminated === 'A' ? match.teamA : match.teamB}
        </p>
      )}
    </div>
  )
}
