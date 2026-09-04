import { Fragment, useMemo, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import { useStatMatches } from '../../lib/statisticheQueries'
import { allTeamsInMatches, calculateH2HBetween, calculateH2HForTeam, type H2HRow } from '../../lib/statisticheCalc'
import { EmptyState } from '../../components/ui'

const COMP_LABEL: Record<string, string> = {
  campionato: 'Camp.',
  svizzero: 'Svizzero',
  girone: 'Girone',
  coppa: 'Coppa',
}

function H2HTable({ rows, highlightTeam }: { rows: H2HRow[]; highlightTeam?: string }) {
  const [expanded, setExpanded] = useState<string | null>(null)

  if (rows.length === 0) {
    return <EmptyState icon="⚔️" title="Nessuno scontro diretto trovato" />
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[30rem] text-sm">
        <thead>
          <tr className="bg-surface-2 text-xs uppercase tracking-wide text-slate-400">
            <th className="px-2 py-2 text-left font-medium">Avversario</th>
            <th className="px-2 py-2 text-center font-medium">G</th>
            <th className="px-2 py-2 text-center font-medium">V</th>
            <th className="px-2 py-2 text-center font-medium">N</th>
            <th className="px-2 py-2 text-center font-medium">P</th>
            <th className="px-2 py-2 text-center font-medium">GF</th>
            <th className="px-2 py-2 text-center font-medium">GS</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <Fragment key={r.opponent}>
              <tr
                onClick={() => setExpanded((e) => (e === r.opponent ? null : r.opponent))}
                className="cursor-pointer border-t border-border bg-surface active:bg-surface-2"
              >
                <td className="px-2 py-2 font-medium text-white">{r.opponent}</td>
                <td className="px-2 py-2 text-center text-slate-300">{r.g}</td>
                <td className="px-2 py-2 text-center text-emerald-300">{r.w}</td>
                <td className="px-2 py-2 text-center text-slate-400">{r.d}</td>
                <td className="px-2 py-2 text-center text-rose-300">{r.l}</td>
                <td className="px-2 py-2 text-center text-slate-300">{r.gf}</td>
                <td className="px-2 py-2 text-center text-slate-300">{r.gs}</td>
              </tr>
              {expanded === r.opponent && (
                <tr className="border-t border-border bg-surface-2/50">
                  <td colSpan={7} className="px-3 py-2">
                    <div className="space-y-1">
                      {[...r.matches]
                        .sort((a, b) => a.giornata - b.giornata)
                        .map((m, i) => (
                          <div key={i} className="flex items-center justify-between text-xs text-slate-300">
                            <span>
                              {COMP_LABEL[m.competizione]} · {m.stagione} · G{m.giornata}
                            </span>
                            <span className="font-semibold text-white">
                              {highlightTeam ?? m.team} {m.gf}-{m.gs} {m.opponent}
                            </span>
                          </div>
                        ))}
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function ScontriDirettiPage() {
  const { manager } = useAuth()
  const matches = useStatMatches()
  const [tab, setTab] = useState<'mia' | 'confronto'>('mia')

  const teams = useMemo(() => allTeamsInMatches(matches), [matches])
  const myTeam = manager?.team_name

  const myRows = useMemo(() => (myTeam ? calculateH2HForTeam(matches, myTeam) : []), [matches, myTeam])

  const [teamA, setTeamA] = useState('')
  const [teamB, setTeamB] = useState('')
  const confrontoRow = useMemo((): H2HRow | null => {
    if (!teamA || !teamB || teamA === teamB) return null
    const rows = calculateH2HForTeam(matches, teamA)
    return rows.find((r) => r.opponent === teamB) ?? { opponent: teamB, g: 0, w: 0, d: 0, l: 0, gf: 0, gs: 0, matches: [] }
  }, [matches, teamA, teamB])

  const dettaglioConfronto = useMemo(
    () => (teamA && teamB && teamA !== teamB ? calculateH2HBetween(matches, teamA, teamB) : []),
    [matches, teamA, teamB],
  )

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-white">Scontri diretti</h1>
      <p className="text-xs text-slate-400">Da Campionato e Coppa, tutte le stagioni disponibili.</p>

      <div className="flex gap-1 rounded-xl border border-border bg-surface p-1 text-sm">
        <button
          onClick={() => setTab('mia')}
          className={`flex-1 rounded-lg py-1.5 font-medium ${tab === 'mia' ? 'bg-accent-strong text-white' : 'text-slate-400'}`}
        >
          La mia squadra
        </button>
        <button
          onClick={() => setTab('confronto')}
          className={`flex-1 rounded-lg py-1.5 font-medium ${tab === 'confronto' ? 'bg-accent-strong text-white' : 'text-slate-400'}`}
        >
          Cerca confronto
        </button>
      </div>

      {tab === 'mia' &&
        (myTeam ? (
          <H2HTable rows={myRows} highlightTeam={myTeam} />
        ) : (
          <EmptyState icon="👤" title="Nessuna squadra associata al tuo profilo" />
        ))}

      {tab === 'confronto' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <select
              value={teamA}
              onChange={(e) => setTeamA(e.target.value)}
              className="rounded-lg border border-border bg-surface-2 px-2 py-2 text-sm text-white outline-none focus:border-accent"
            >
              <option value="">Squadra A</option>
              {teams.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <select
              value={teamB}
              onChange={(e) => setTeamB(e.target.value)}
              className="rounded-lg border border-border bg-surface-2 px-2 py-2 text-sm text-white outline-none focus:border-accent"
            >
              <option value="">Squadra B</option>
              {teams.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {!teamA || !teamB ? (
            <EmptyState icon="🔍" title="Scegli due squadre" />
          ) : teamA === teamB ? (
            <EmptyState icon="⚠️" title="Scegli due squadre diverse" />
          ) : confrontoRow && confrontoRow.g === 0 ? (
            <EmptyState icon="⚔️" title={`Nessuno scontro tra ${teamA} e ${teamB}`} />
          ) : (
            confrontoRow && (
              <div className="space-y-3">
                <div className="rounded-xl border border-border bg-surface p-3 text-center">
                  <p className="text-sm text-slate-300">
                    {teamA} <span className="font-bold text-white">{confrontoRow.w}V {confrontoRow.d}N {confrontoRow.l}P</span> {teamB}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Gol: {confrontoRow.gf}-{confrontoRow.gs}
                  </p>
                </div>
                <div className="space-y-1">
                  {dettaglioConfronto.map((m, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-xs text-slate-300"
                    >
                      <span>
                        {COMP_LABEL[m.competizione]} · {m.stagione} · G{m.giornata}
                      </span>
                      <span className="font-semibold text-white">
                        {teamA} {m.gf}-{m.gs} {teamB}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  )
}
