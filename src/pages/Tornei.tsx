import { useMemo, useState } from 'react'
import { useManagers } from '../lib/queries'
import { buildGiornateScores, useOverrides, usePunteggiGiornata } from '../lib/leagueQueries'
import { calculateStandings, resolveTournament, type ClassificaRow, type TorneoMatch } from '../lib/tornei'
import { initialMatches } from '../lib/torneoData'
import { EmptyState, PageLoader } from '../components/ui'
import { useAuth } from '../auth/AuthProvider'

type Tab = 'battle' | 'torneo'

export default function TorneiPage() {
  const [tab, setTab] = useState<Tab>('battle')
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-white">Tornei</h1>
      <div className="flex rounded-xl border border-border bg-surface p-1 text-sm">
        <TabBtn active={tab === 'battle'} onClick={() => setTab('battle')}>
          Battle Royale
        </TabBtn>
        <TabBtn active={tab === 'torneo'} onClick={() => setTab('torneo')}>
          Torneo
        </TabBtn>
      </div>
      {tab === 'battle' && <BattleRoyaleTab />}
      {tab === 'torneo' && <TorneoTab />}
    </div>
  )
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'flex-1 rounded-lg py-2 font-medium transition-colors',
        active ? 'bg-accent-strong text-white' : 'text-slate-400',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

/* ---------------- Battle Royale ---------------- */

function BattleRoyaleTab() {
  const { data: managers } = useManagers()
  const { data: punteggi } = usePunteggiGiornata()
  const { manager: me } = useAuth()

  const { classifica, hasData } = useMemo(() => {
    if (!managers || !punteggi) return { classifica: [] as ClassificaRow[], hasData: false }
    const teams = managers.filter((m) => !!m.team_name).map((m) => m.team_name || m.display_name)
    const scores = buildGiornateScores(punteggi, managers)
    const res = calculateStandings(scores, teams)
    return { classifica: res.classifica, hasData: Object.keys(scores).length > 0 }
  }, [managers, punteggi])

  const myTeam = me?.team_name || me?.display_name

  if (!managers || !punteggi) return <PageLoader />
  if (!hasData)
    return <EmptyState icon="⚔️" title="Nessun punteggio" hint="La classifica appare quando l'admin inserisce i punteggi di giornata." />

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[34rem] text-sm">
        <thead>
          <tr className="bg-surface-2 text-xs uppercase tracking-wide text-slate-400">
            <th className="px-2 py-2 text-left font-medium">#</th>
            <th className="px-2 py-2 text-left font-medium">Squadra</th>
            <th className="px-2 py-2 text-center font-medium">Pt</th>
            <th className="px-2 py-2 text-center font-medium">V</th>
            <th className="px-2 py-2 text-center font-medium">N</th>
            <th className="px-2 py-2 text-center font-medium">P</th>
            <th className="px-2 py-2 text-center font-medium">DR</th>
            <th className="px-2 py-2 text-center font-medium">Fanta</th>
          </tr>
        </thead>
        <tbody>
          {classifica.map((r) => (
            <tr
              key={r.team}
              className={`border-t border-border ${r.team === myTeam ? 'bg-accent/10' : 'bg-surface'}`}
            >
              <td className="px-2 py-2 text-slate-400">{r.pos}</td>
              <td className="px-2 py-2 font-medium text-white">
                {r.team}
                {r.lastDelta > 0 && <span className="ml-1 text-[10px] text-accent">+{r.lastDelta}</span>}
              </td>
              <td className="px-2 py-2 text-center font-bold text-accent">{r.pts}</td>
              <td className="px-2 py-2 text-center text-slate-300">{r.w}</td>
              <td className="px-2 py-2 text-center text-slate-300">{r.d}</td>
              <td className="px-2 py-2 text-center text-slate-300">{r.l}</td>
              <td className="px-2 py-2 text-center text-slate-300">
                {r.dr > 0 ? `+${r.dr}` : r.dr}
              </td>
              <td className="px-2 py-2 text-center text-slate-400">{r.fantaTotal.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ---------------- Torneo bracket ---------------- */

function TorneoTab() {
  const { data: managers } = useManagers()
  const { data: punteggi } = usePunteggiGiornata()
  const { data: overrides } = useOverrides()

  const matchesByDay = useMemo(() => {
    if (!managers || !punteggi) return []
    const scores = buildGiornateScores(punteggi, managers)
    const ovr: Record<string, 'A' | 'B'> = {}
    for (const o of overrides ?? []) ovr[o.match_id] = o.winner as 'A' | 'B'
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
    <div className="space-y-3">
      <p className="text-xs text-slate-400">
        Il bracket avanza in automatico dai punteggi fanta di ogni giornata (stesse fasce della Battle Royale).
      </p>
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
