import { useMemo } from 'react'
import { useManagers } from '../../lib/queries'
import { buildGiornateScores, usePunteggiGiornata } from '../../lib/leagueQueries'
import { calculateStandings, type ClassificaRow } from '../../lib/tornei'
import { EmptyState, PageLoader } from '../../components/ui'
import { useAuth } from '../../auth/AuthProvider'

export default function BattleRoyalePage() {
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

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-white">Battle Royale</h1>
      {!hasData ? (
        <EmptyState
          icon="⚔️"
          title="Nessun punteggio"
          hint="La classifica appare quando l'admin inserisce i punteggi di giornata."
        />
      ) : (
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
      )}
    </div>
  )
}
