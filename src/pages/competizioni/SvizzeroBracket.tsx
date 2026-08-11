import { useMemo } from 'react'
import { useManagers } from '../../lib/queries'
import { buildGiornateScores, useOverrides, usePunteggiGiornata } from '../../lib/leagueQueries'
import {
  buildTeamNameMap,
  resolveSwissState,
  SWISS_TURNI,
  useMegaAccoppiamenti,
  useMegaTurni,
  type SwissMatchResolved,
  type SwissResolution,
  type SwissTeamState,
} from '../../lib/megagalattico'
import type { TorneoOverrideInput } from '../../lib/tornei'
import { EmptyState, PageLoader } from '../../components/ui'

/**
 * Tabellone svizzero in stile "Swiss Stage" (colonne per turno, in scroll
 * orizzontale su mobile): dentro ogni turno le squadre sono raggruppate per
 * record V-P condiviso (0-0 → 1-0/0-1 → 2-0/1-1/0-2 → 2-1/1-2 → 2-2
 * spareggio). Le squadre che hanno già staccato il pass (3 vittorie) o sono
 * uscite (3 sconfitte) escono dai raggruppamenti e finiscono nella colonna
 * di esito a destra.
 */
export default function SvizzeroBracket() {
  const { data: managers } = useManagers()
  const { data: punteggi } = usePunteggiGiornata()
  const { data: overrides } = useOverrides()
  const { data: megaTurni } = useMegaTurni()
  const { data: accoppiamenti } = useMegaAccoppiamenti()

  const squadre = useMemo(() => (managers ?? []).filter((m) => !!m.team_name), [managers])
  const teamNameById = useMemo(() => buildTeamNameMap(squadre), [squadre])
  const allIds = useMemo(() => squadre.map((m) => m.id), [squadre])

  const scoresMap = useMemo(() => {
    if (!managers || !punteggi) return {}
    return buildGiornateScores(punteggi, managers)
  }, [managers, punteggi])

  const overrideMap = useMemo(() => {
    const ovr: Record<string, TorneoOverrideInput> = {}
    for (const o of overrides ?? []) ovr[o.match_id] = { winner: o.winner as 'A' | 'B', golA: o.gol_a, golB: o.gol_b }
    return ovr
  }, [overrides])

  const turniSvizzero = useMemo(() => {
    const m = new Map<number, number | null>()
    for (const t of megaTurni ?? []) if (t.step_type === 'svizzero') m.set(t.step_numero, t.giornata_reale)
    return m
  }, [megaTurni])

  const swiss = useMemo<SwissResolution | null>(() => {
    if (allIds.length === 0) return null
    return resolveSwissState(accoppiamenti ?? [], turniSvizzero, scoresMap, teamNameById, overrideMap, allIds)
  }, [accoppiamenti, turniSvizzero, scoresMap, teamNameById, overrideMap, allIds])

  if (!managers) return <PageLoader />
  if (!accoppiamenti || accoppiamenti.length === 0 || !swiss) {
    return (
      <EmptyState
        icon="🎲"
        title="Sorteggio non ancora effettuato"
        hint="Il primo turno dello svizzero non è ancora stato sorteggiato dall'admin."
      />
    )
  }

  const qualificate = [...swiss.states.values()]
    .filter((s) => s.status === 'qualified')
    .sort((a, b) => b.wins - a.wins || a.losses - b.losses)
  const eliminate = [...swiss.states.values()]
    .filter((s) => s.status === 'eliminated')
    .sort((a, b) => b.wins - a.wins || a.losses - b.losses)

  const colonne = Array.from({ length: SWISS_TURNI }, (_, i) => i + 1)
    .map((turno) => ({ turno, matches: swiss.matches.filter((m) => m.turno === turno) }))
    .filter((c) => c.matches.length > 0)

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">Torneo Megagalattico</p>
        <h2 className="text-2xl font-black uppercase tracking-tight text-white">Fase Svizzera</h2>
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max items-stretch gap-2">
          {colonne.map(({ turno, matches }, idx) => (
            <div key={turno} className="flex items-stretch gap-2">
              <BracketColumn
                turno={turno}
                matches={matches}
                isSpareggio={turno === SWISS_TURNI}
                teamNameById={teamNameById}
              />
              {(idx < colonne.length - 1 || qualificate.length > 0 || eliminate.length > 0) && <Connector />}
            </div>
          ))}

          {(qualificate.length > 0 || eliminate.length > 0) && (
            <EsitoColumn qualificate={qualificate} eliminate={eliminate} teamNameById={teamNameById} />
          )}
        </div>
      </div>
    </div>
  )
}

function Connector() {
  return (
    <div className="flex w-4 shrink-0 items-center justify-center self-center text-slate-600">
      <span className="text-lg leading-none">›</span>
    </div>
  )
}

function BracketColumn({
  turno,
  matches,
  isSpareggio,
  teamNameById,
}: {
  turno: number
  matches: SwissMatchResolved[]
  isSpareggio: boolean
  teamNameById: Map<string, string>
}) {
  const giornataReale = matches[0]?.giornataReale ?? null
  const groups = groupByRecord(matches)

  return (
    <div className="flex w-64 shrink-0 flex-col gap-2.5">
      <div className="text-center">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          Turno {turno}
          {isSpareggio && ' · spareggio'}
        </p>
        {giornataReale != null && <p className="text-xs font-semibold text-accent">Giornata {giornataReale}</p>}
      </div>

      {groups.map(({ record, items }) => (
        <div key={record} className="overflow-hidden rounded-xl border border-border bg-surface">
          <div className="bg-surface-2 px-2.5 py-1">
            <span className="text-xs font-bold text-white">{record}</span>
          </div>
          <div className="divide-y divide-border">
            {items.map((m) => (
              <SwissMatchRow key={`${m.managerA}-${m.managerB}`} match={m} teamNameById={teamNameById} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function EsitoColumn({
  qualificate,
  eliminate,
  teamNameById,
}: {
  qualificate: SwissTeamState[]
  eliminate: SwissTeamState[]
  teamNameById: Map<string, string>
}) {
  return (
    <div className="flex w-56 shrink-0 flex-col gap-2.5">
      <div className="text-center">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Esito</p>
      </div>

      {qualificate.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-emerald-500/30 bg-surface">
          <div className="bg-emerald-500/10 px-2.5 py-1">
            <span className="text-xs font-bold uppercase tracking-wide text-emerald-300">✦ Girone A</span>
          </div>
          <div className="divide-y divide-border">
            {qualificate.map((s) => (
              <div key={s.managerId} className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-sm">
                <span className="min-w-0 truncate font-medium text-white">
                  {teamNameById.get(s.managerId) ?? s.managerId}
                </span>
                <span className="shrink-0 text-xs font-semibold text-emerald-300">
                  {s.wins}-{s.losses}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {eliminate.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-rose-500/30 bg-surface">
          <div className="bg-rose-500/10 px-2.5 py-1">
            <span className="text-xs font-bold uppercase tracking-wide text-rose-300">Girone B</span>
          </div>
          <div className="divide-y divide-border">
            {eliminate.map((s) => (
              <div key={s.managerId} className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-sm">
                <span className="min-w-0 truncate font-medium text-white">
                  {teamNameById.get(s.managerId) ?? s.managerId}
                </span>
                <span className="shrink-0 text-xs font-semibold text-rose-300">
                  {s.wins}-{s.losses}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function groupByRecord(matches: SwissMatchResolved[]): { record: string; items: SwissMatchResolved[] }[] {
  const groups = new Map<string, SwissMatchResolved[]>()
  for (const m of matches) {
    if (!groups.has(m.record)) groups.set(m.record, [])
    groups.get(m.record)!.push(m)
  }
  return [...groups.entries()]
    .sort(([a], [b]) => {
      const [wa, la] = a.split('-').map(Number)
      const [wb, lb] = b.split('-').map(Number)
      return wb - wa || la - lb
    })
    .map(([record, items]) => ({ record, items }))
}

function SwissMatchRow({ match, teamNameById }: { match: SwissMatchResolved; teamNameById: Map<string, string> }) {
  const nameA = teamNameById.get(match.managerA) ?? match.managerA
  const nameB = teamNameById.get(match.managerB) ?? match.managerB
  const winnerA = match.winner === 'A'
  const winnerB = match.winner === 'B'
  const pending = match.winner == null && match.scoreA == null

  return (
    <div className="px-2.5 py-1.5 text-sm">
      <div className="flex items-center gap-1.5">
        <span
          className={[
            'min-w-0 flex-1 truncate font-medium',
            winnerA ? 'text-emerald-300' : 'text-slate-200',
          ].join(' ')}
        >
          {nameA}
        </span>
        <span className="shrink-0 rounded-md border border-border bg-surface-2 px-1.5 py-0.5 text-[11px] font-bold text-white">
          {match.golA ?? '–'}-{match.golB ?? '–'}
        </span>
        <span
          className={[
            'min-w-0 flex-1 truncate text-right font-medium',
            winnerB ? 'text-emerald-300' : 'text-slate-200',
          ].join(' ')}
        >
          {nameB}
        </span>
      </div>
      {pending && <p className="mt-0.5 text-[10px] text-slate-500">In attesa dei punteggi</p>}
    </div>
  )
}
