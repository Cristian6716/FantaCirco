import { useMemo, useState } from 'react'
import { useMegaData } from '../../lib/megaData'
import { splitToFasce, type GironeRow, type RoundRobinMatch } from '../../lib/megagalattico'
import { buildRankingTorneo, PUNTI_GIRONE, type RankingTorneoRow } from '../../lib/rankingTorneo'
import { EmptyState, PageLoader } from '../../components/ui'
import SvizzeroBracket from './SvizzeroBracket'

type SubTab = 'svizzero' | 'gironi' | 'fasce' | 'ranking'

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
        <SubTabBtn active={tab === 'ranking'} onClick={() => setTab('ranking')}>
          Ranking
        </SubTabBtn>
      </div>
      {tab === 'svizzero' && <SvizzeroBracket />}
      {tab === 'gironi' && <GironiView />}
      {tab === 'fasce' && <FasceView />}
      {tab === 'ranking' && <RankingTorneoView />}
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

function RankingTorneoView() {
  const { managers, teamNameById, allIds, swiss, classificaA, classificaB } = useMegaData()

  const righe = useMemo(
    () => buildRankingTorneo(swiss?.matches ?? [], classificaA, classificaB, allIds),
    [swiss, classificaA, classificaB, allIds],
  )

  if (!managers) return <PageLoader />
  if (righe.length === 0 || righe.every((r) => r.totale === 0)) {
    return (
      <EmptyState
        icon="📊"
        title="Nessun punto ancora assegnato"
        hint="I punti ranking maturano dal primo turno dello svizzero in poi."
      />
    )
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[22rem] text-sm">
          <thead>
            <tr className="bg-surface-2 text-xs uppercase tracking-wide text-slate-400">
              <th className="px-2 py-2 text-left font-medium">Squadra</th>
              <th className="px-2 py-2 text-center font-medium">Sv.</th>
              <th className="px-2 py-2 text-center font-medium">Gir.</th>
              <th className="px-2 py-2 text-right font-medium">Tot</th>
            </tr>
          </thead>
          <tbody>
            {righe.map((r) => (
              <RankingTorneoRowView key={r.managerId} row={r} teamNameById={teamNameById} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-border bg-surface p-3">
        <h3 className="text-sm font-semibold text-white">Come si assegnano i punti</h3>

        <p className="mt-2.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          Svizzero — per vittoria
        </p>
        <p className="mt-1 text-xs leading-relaxed text-slate-400">
          Dipende dal record V-P che il vincitore aveva <span className="font-medium text-slate-300">prima</span> della
          partita: più sei avanti, più la vittoria pesa. Chi perde non prende punti.
        </p>
        <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          <PuntiChip record="2-0 · 2-1" punti={5} nota="+2 / +1" />
          <PuntiChip record="1-0" punti={3} nota="+1" />
          <PuntiChip record="0-0 · 1-1 · 2-2" punti={2} nota="pari" />
          <PuntiChip record="0-1 · 1-2 · 0-2" punti={1} nota="sotto" />
        </div>

        <p className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          Gironi — per partita
        </p>
        <p className="mt-1 text-xs leading-relaxed text-slate-400">
          Il Girone A (record svizzero positivo) vale il doppio del Girone B: vittoria{' '}
          <span className="font-medium text-slate-300">{PUNTI_GIRONE.A.vittoria} pt</span> e pareggio{' '}
          <span className="font-medium text-slate-300">{PUNTI_GIRONE.A.pareggio} pt</span> in A, vittoria{' '}
          <span className="font-medium text-slate-300">{PUNTI_GIRONE.B.vittoria} pt</span> e pareggio{' '}
          <span className="font-medium text-slate-300">{PUNTI_GIRONE.B.pareggio} pt</span> in B.
        </p>

        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          I punti della fase a eliminazione non sono ancora stati definiti, quindi non compaiono in questa tabella.
        </p>
      </div>
    </div>
  )
}

function PuntiChip({ record, punti, nota }: { record: string; punti: number; nota: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-2 px-2 py-1.5">
      <p className="text-xs font-semibold text-white">{record}</p>
      <p className="mt-0.5 text-sm font-bold text-accent">{punti} pt</p>
      <p className="text-[10px] text-slate-500">{nota}</p>
    </div>
  )
}

function RankingTorneoRowView({
  row,
  teamNameById,
}: {
  row: RankingTorneoRow
  teamNameById: Map<string, string>
}) {
  return (
    <tr className="border-t border-border bg-surface">
      <td className="px-2 py-2">
        <span className="font-medium text-white">
          {row.pos}. {teamNameById.get(row.managerId) ?? row.managerId}
        </span>
        {row.gironeLabel && <span className="ml-1.5 text-xs text-slate-500">Gir. {row.gironeLabel}</span>}
      </td>
      <td className="px-2 py-2 text-center text-slate-300">{row.svizzero}</td>
      <td className="px-2 py-2 text-center text-slate-300">{row.girone}</td>
      <td className="px-2 py-2 text-right font-bold text-accent">{row.totale}</td>
    </tr>
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
