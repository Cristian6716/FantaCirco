import { useMemo, useState } from 'react'
import { useManagers } from '../../lib/queries'
import { buildGiornateScores, useOverrides, usePunteggiGiornata } from '../../lib/leagueQueries'
import {
  buildTeamNameMap,
  resolveGironeStandings,
  resolveSwissState,
  splitToFasce,
  useMegaAccoppiamenti,
  useMegaGironiPartite,
  useMegaTurni,
  type GironeRow,
  type RoundRobinMatch,
} from '../../lib/megagalattico'
import type { TorneoOverrideInput } from '../../lib/tornei'
import { EmptyState, PageLoader } from '../../components/ui'
import SvizzeroBracket from './SvizzeroBracket'

type SubTab = 'svizzero' | 'gironi' | 'fasce'

export default function MegagalatticoPage() {
  const [tab, setTab] = useState<SubTab>('svizzero')
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-white">Torneo Megagalattico</h1>
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-surface p-1 text-sm">
        <SubTabBtn active={tab === 'svizzero'} onClick={() => setTab('svizzero')}>
          Svizzero
        </SubTabBtn>
        <SubTabBtn active={tab === 'gironi'} onClick={() => setTab('gironi')}>
          Gironi
        </SubTabBtn>
        <SubTabBtn active={tab === 'fasce'} onClick={() => setTab('fasce')}>
          Fasce
        </SubTabBtn>
      </div>
      {tab === 'svizzero' && <SvizzeroBracket />}
      {tab === 'gironi' && <GironiView />}
      {tab === 'fasce' && <FasceView />}
    </div>
  )
}

function SubTabBtn({
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

/** Dati condivisi da vista Gironi e vista Fasce: classifiche combinate svizzero+girone. */
function useMegaData() {
  const { data: managers } = useManagers()
  const { data: punteggi } = usePunteggiGiornata()
  const { data: overrides } = useOverrides()
  const { data: megaTurni } = useMegaTurni()
  const { data: accoppiamenti } = useMegaAccoppiamenti()
  const { data: gironiPartite } = useMegaGironiPartite()

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

  const turniGironi = useMemo(() => {
    const m = new Map<number, number | null>()
    for (const t of megaTurni ?? []) if (t.step_type === 'gironi') m.set(t.step_numero, t.giornata_reale)
    return m
  }, [megaTurni])

  const swiss = useMemo(() => {
    if (allIds.length === 0) return null
    return resolveSwissState(accoppiamenti ?? [], turniSvizzero, scoresMap, teamNameById, overrideMap, allIds)
  }, [accoppiamenti, turniSvizzero, scoresMap, teamNameById, overrideMap, allIds])

  const swissRecordsMap = useMemo(() => {
    const m = new Map<string, { wins: number; losses: number }>()
    for (const s of swiss?.states.values() ?? []) m.set(s.managerId, { wins: s.wins, losses: s.losses })
    return m
  }, [swiss])

  const partiteA = useMemo(
    () =>
      (gironiPartite ?? [])
        .filter((p) => p.girone === 'A')
        .map((p): RoundRobinMatch => ({ round: p.round, managerA: p.manager_a, managerB: p.manager_b })),
    [gironiPartite],
  )
  const partiteB = useMemo(
    () =>
      (gironiPartite ?? [])
        .filter((p) => p.girone === 'B')
        .map((p): RoundRobinMatch => ({ round: p.round, managerA: p.manager_a, managerB: p.manager_b })),
    [gironiPartite],
  )
  const idsA = useMemo(() => [...new Set(partiteA.flatMap((p) => [p.managerA, p.managerB]))], [partiteA])
  const idsB = useMemo(() => [...new Set(partiteB.flatMap((p) => [p.managerA, p.managerB]))], [partiteB])

  const classificaA = useMemo(
    () => resolveGironeStandings(idsA, swissRecordsMap, partiteA, turniGironi, scoresMap, teamNameById),
    [idsA, swissRecordsMap, partiteA, turniGironi, scoresMap, teamNameById],
  )
  const classificaB = useMemo(
    () => resolveGironeStandings(idsB, swissRecordsMap, partiteB, turniGironi, scoresMap, teamNameById),
    [idsB, swissRecordsMap, partiteB, turniGironi, scoresMap, teamNameById],
  )

  return { managers, teamNameById, gironiPartite, classificaA, classificaB, partiteA, partiteB, turniGironi, scoresMap }
}

function GironiView() {
  const { managers, teamNameById, gironiPartite, classificaA, classificaB } = useMegaData()
  if (!managers) return <PageLoader />
  if (!gironiPartite || gironiPartite.length === 0) {
    return (
      <EmptyState
        icon="📋"
        title="Gironi non ancora generati"
        hint="Il calendario dei due gironi viene generato dall'admin al termine dello svizzero."
      />
    )
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <PublicGironeTable title="Girone A" classifica={classificaA} teamNameById={teamNameById} />
      <PublicGironeTable title="Girone B" classifica={classificaB} teamNameById={teamNameById} />
    </div>
  )
}

function gironeCompleto(
  partite: RoundRobinMatch[],
  turniGironi: Map<number, number | null>,
  scoresMap: Record<string, Record<string, number>>,
  teamNameById: Map<string, string>,
): boolean {
  if (partite.length === 0) return false
  return partite.every((p) => {
    const g = turniGironi.get(p.round)
    if (g == null) return false
    const dayScores = scoresMap[String(g)] ?? {}
    const teamA = teamNameById.get(p.managerA)
    const teamB = teamNameById.get(p.managerB)
    return teamA != null && teamB != null && dayScores[teamA] != null && dayScores[teamB] != null
  })
}

function FasceView() {
  const { managers, teamNameById, gironiPartite, classificaA, classificaB, partiteA, partiteB, turniGironi, scoresMap } =
    useMegaData()
  if (!managers) return <PageLoader />

  const pronte =
    !!gironiPartite &&
    gironiPartite.length > 0 &&
    gironeCompleto(partiteA, turniGironi, scoresMap, teamNameById) &&
    gironeCompleto(partiteB, turniGironi, scoresMap, teamNameById)

  if (!pronte) {
    return (
      <EmptyState
        icon="🏅"
        title="Fasce non ancora disponibili"
        hint="Compaiono al termine di entrambi i gironi, prima del sorteggio verso la Coppa."
      />
    )
  }

  const fasce = splitToFasce(classificaA, classificaB)
  const sezioni: { label: string; ids: string[] }[] = [
    { label: 'Elite — 1°-4° Girone A', ids: fasce.elite },
    { label: 'Outsider — 5°-8° Girone A', ids: fasce.outsider },
    { label: 'Rivelazioni — 1°-4° Girone B', ids: fasce.rivelazioni },
    { label: 'Fondo — 5°-8° Girone B', ids: fasce.fondo },
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {sezioni.map((s) => (
        <div key={s.label} className="rounded-xl border border-border bg-surface p-3">
          <h3 className="text-sm font-semibold text-white">{s.label}</h3>
          <div className="mt-2 space-y-1">
            {s.ids.map((id) => (
              <p key={id} className="text-sm text-slate-200">
                {teamNameById.get(id) ?? id}
              </p>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function PublicGironeTable({
  title,
  classifica,
  teamNameById,
}: {
  title: string
  classifica: GironeRow[]
  teamNameById: Map<string, string>
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[22rem] text-sm">
        <thead>
          <tr className="bg-surface-2 text-xs uppercase tracking-wide text-slate-400">
            <th className="px-2 py-2 text-left font-medium">{title}</th>
            <th className="px-2 py-2 text-center font-medium">Pt</th>
            <th className="px-2 py-2 text-center font-medium">V</th>
            <th className="px-2 py-2 text-center font-medium">N</th>
            <th className="px-2 py-2 text-center font-medium">P</th>
            <th className="px-2 py-2 text-center font-medium">DR</th>
            <th className="px-2 py-2 text-center font-medium">Sv.</th>
          </tr>
        </thead>
        <tbody>
          {classifica.map((r) => (
            <tr key={r.managerId} className="border-t border-border bg-surface">
              <td className="px-2 py-2 font-medium text-white">
                {r.pos}. {teamNameById.get(r.managerId) ?? r.managerId}
              </td>
              <td className="px-2 py-2 text-center font-bold text-accent">{r.pts}</td>
              <td className="px-2 py-2 text-center text-slate-300">{r.w}</td>
              <td className="px-2 py-2 text-center text-slate-300">{r.d}</td>
              <td className="px-2 py-2 text-center text-slate-300">{r.l}</td>
              <td className="px-2 py-2 text-center text-slate-300">{r.dr > 0 ? `+${r.dr}` : r.dr}</td>
              <td className="px-2 py-2 text-center text-slate-500">
                {r.swissWins}-{r.swissLosses}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
