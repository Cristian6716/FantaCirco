import { useMemo } from 'react'
import { usePartite } from '../../lib/leagueQueries'
import { calculateCampionatoStandings } from '../../lib/tornei'
import { TEAM_NAMES } from '../../lib/teams'
import { PageLoader } from '../../components/ui'
import { useAuth } from '../../auth/AuthProvider'

export default function CampionatoPage() {
  const { data: partite } = usePartite()
  const { manager: me } = useAuth()

  const classifica = useMemo(() => {
    if (!partite) return []
    return calculateCampionatoStandings(partite, [...TEAM_NAMES])
  }, [partite])

  const myTeam = me?.team_name || me?.display_name

  if (!partite) return <PageLoader />

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-white">Campionato</h1>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[34rem] text-sm">
          <thead>
            <tr className="bg-surface-2 text-xs uppercase tracking-wide text-slate-400">
              <th className="px-2 py-2 text-left font-medium">#</th>
              <th className="px-2 py-2 text-left font-medium">Squadra</th>
              <th className="px-2 py-2 text-center font-medium">G</th>
              <th className="px-2 py-2 text-center font-medium">V</th>
              <th className="px-2 py-2 text-center font-medium">N</th>
              <th className="px-2 py-2 text-center font-medium">P</th>
              <th className="px-2 py-2 text-center font-medium">G+</th>
              <th className="px-2 py-2 text-center font-medium">G-</th>
              <th className="px-2 py-2 text-center font-medium">DR</th>
              <th className="px-2 py-2 text-center font-medium">Pt</th>
            </tr>
          </thead>
          <tbody>
            {classifica.map((r) => (
              <tr
                key={r.team}
                className={`border-t border-border ${r.team === myTeam ? 'bg-accent/10' : 'bg-surface'}`}
              >
                <td className="px-2 py-2 text-slate-400">{r.pos}</td>
                <td className="px-2 py-2 font-medium text-white">{r.team}</td>
                <td className="px-2 py-2 text-center text-slate-300">{r.g}</td>
                <td className="px-2 py-2 text-center text-slate-300">{r.w}</td>
                <td className="px-2 py-2 text-center text-slate-300">{r.d}</td>
                <td className="px-2 py-2 text-center text-slate-300">{r.l}</td>
                <td className="px-2 py-2 text-center text-slate-300">{r.gf}</td>
                <td className="px-2 py-2 text-center text-slate-300">{r.gs}</td>
                <td className="px-2 py-2 text-center text-slate-300">{r.dr > 0 ? `+${r.dr}` : r.dr}</td>
                <td className="px-2 py-2 text-center font-bold text-accent">{r.pts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
