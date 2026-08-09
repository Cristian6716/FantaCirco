import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import {
  useAuctions,
  useManagers,
  useMyParticipations,
  usePlayers,
  type Auction,
} from '../lib/queries'
import { Countdown, EmptyState, PageLoader, RoleBadge, StatusBadge } from '../components/ui'
import { isActive } from '../lib/format'

type Filter = 'all' | 'mine'

/** Scadenza della fase in corso (per le aste in pausa il timer è congelato). */
function phaseDeadline(a: Auction): string {
  return a.status === 'phase1' ? a.phase1_ends_at : a.phase2_ends_at
}

/** Priorità di fase in "Le tue aste": prima la fase 2, poi la fase 1, in fondo le pause. */
const PHASE_RANK: Record<string, number> = { phase2: 0, phase1: 1, paused: 2 }

export default function AuctionsPage() {
  const { manager } = useAuth()
  const { data: auctions, isLoading } = useAuctions()
  const { data: players } = usePlayers()
  const { data: managers } = useManagers()
  const { data: myParts } = useMyParticipations()
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')

  const playerMap = useMemo(
    () => new Map((players ?? []).map((p) => [p.id, p])),
    [players],
  )
  const managerMap = useMemo(
    () => new Map((managers ?? []).map((m) => [m.id, m])),
    [managers],
  )
  const myActiveAuctionIds = useMemo(
    () => new Set((myParts ?? []).filter((p) => !p.withdrawn).map((p) => p.auction_id)),
    [myParts],
  )

  // Le aste chiuse escono da qui e finiscono in archivio, qualunque sia l'esito.
  const closedCount = useMemo(
    () => (auctions ?? []).filter((a) => !isActive(a.status)).length,
    [auctions],
  )

  const list = useMemo(() => {
    let res = (auctions ?? []).filter((a) => isActive(a.status))
    if (filter === 'mine') res = res.filter((a) => myActiveAuctionIds.has(a.id))
    const q = search.trim().toLowerCase()
    if (q) {
      res = res.filter((a) => {
        const p = playerMap.get(a.player_id)
        if (!p) return false
        return (
          p.name.toLowerCase().includes(q) || (p.real_team ?? '').toLowerCase().includes(q)
        )
      })
    }
    // Nelle "tue aste" conta l'urgenza: fase 2 in cima, poi la scadenza più vicina.
    if (filter === 'mine') {
      res = [...res].sort((x, y) => {
        const rank = (PHASE_RANK[x.status] ?? 3) - (PHASE_RANK[y.status] ?? 3)
        if (rank !== 0) return rank
        return new Date(phaseDeadline(x)).getTime() - new Date(phaseDeadline(y)).getTime()
      })
    }
    return res
  }, [auctions, filter, myActiveAuctionIds, playerMap, search])

  if (isLoading) return <PageLoader />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-white">Aste</h1>
        <Link
          to="/asta/giocatori"
          className="rounded-lg bg-accent-strong px-3 py-1.5 text-sm font-semibold text-white active:scale-95"
        >
          + Avvia asta
        </Link>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Cerca giocatore o squadra…"
        className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-white outline-none focus:border-accent"
      />

      <div className="flex items-center gap-2">
        <div className="flex rounded-xl border border-border bg-surface p-1">
          <SegBtn active={filter === 'all'} onClick={() => setFilter('all')}>
            Tutte
          </SegBtn>
          <SegBtn active={filter === 'mine'} onClick={() => setFilter('mine')}>
            Le tue aste
          </SegBtn>
        </div>
        <Link
          to="/asta/archivio"
          className="ml-auto flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-slate-300"
        >
          📦 Archivio
          <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] text-slate-400">
            {closedCount}
          </span>
        </Link>
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={search.trim() ? '🔍' : '🔨'}
          title={
            search.trim()
              ? 'Nessuna asta trovata'
              : filter === 'mine'
                ? 'Non partecipi a nessuna asta'
                : 'Nessuna asta attiva'
          }
          hint={
            search.trim()
              ? 'Nessun giocatore con asta attiva corrisponde alla ricerca.'
              : filter === 'mine'
                ? undefined
                : closedCount > 0
                  ? 'Le aste concluse sono in archivio.'
                  : 'Avvia un’asta dalla lista giocatori.'
          }
        />
      ) : (
        <div className="space-y-2.5">
          {list.map((a) => (
            <AuctionCard
              key={a.id}
              auction={a}
              playerName={playerMap.get(a.player_id)?.name ?? '—'}
              playerRoles={playerMap.get(a.player_id)?.roles ?? []}
              playerTeam={playerMap.get(a.player_id)?.real_team ?? null}
              leaderName={a.leader_id ? managerMap.get(a.leader_id)?.display_name ?? '—' : '—'}
              isLeader={a.leader_id === manager?.id}
              mine={myActiveAuctionIds.has(a.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function SegBtn({
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
        'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
        active ? 'bg-accent-strong text-white' : 'text-slate-400',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function AuctionCard({
  auction,
  playerName,
  playerRoles,
  playerTeam,
  leaderName,
  isLeader,
  mine,
}: {
  auction: Auction
  playerName: string
  playerRoles: string[]
  playerTeam: string | null
  leaderName: string
  isLeader: boolean
  mine: boolean
}) {
  const deadline = phaseDeadline(auction)
  const isPhase2 = auction.status === 'phase2'
  const isPaused = auction.status === 'paused'

  // Gerarchia visiva: verde = la stai vincendo, ambra = fase 2, spento = in pausa.
  const shell = isLeader
    ? 'border-accent/60 bg-accent/[0.07] shadow-[0_0_0_1px_rgb(34_197_94/0.15)]'
    : isPhase2
      ? 'border-amber-500/50 bg-amber-500/[0.06]'
      : isPaused
        ? 'border-border bg-surface opacity-60'
        : 'border-border bg-surface'

  return (
    <Link
      to={`/asta/aste/${auction.id}`}
      className={`relative block overflow-hidden rounded-2xl border p-3.5 active:scale-[0.99] ${shell}`}
    >
      {/* La fase 2 resta riconoscibile anche quando la card è verde perché sei in testa */}
      {isPhase2 && <span className="absolute inset-y-0 left-0 w-1 bg-amber-400/80" />}

      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <RoleBadge roles={playerRoles} />
          <div className="min-w-0">
            <p className="truncate font-semibold text-white">{playerName}</p>
            {playerTeam && <p className="truncate text-xs text-slate-400">{playerTeam}</p>}
          </div>
        </div>
        <StatusBadge status={auction.status} />
      </div>

      <div className="mt-3 flex items-end justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-slate-400">In testa</p>
          <p className={`text-sm font-medium ${isLeader ? 'text-accent' : 'text-slate-200'}`}>
            {isLeader ? 'Tu' : leaderName}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold leading-none text-white">{auction.current_bid}</p>
          <p className="text-[10px] uppercase tracking-wide text-slate-400">crediti</p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5 text-xs">
        {isPaused ? (
          <span className="text-slate-400">In pausa</span>
        ) : (
          <span className="text-slate-400">
            Termina fase tra{' '}
            <Countdown
              target={deadline}
              className={`font-semibold ${isPhase2 ? 'text-amber-300' : 'text-slate-200'}`}
            />
          </span>
        )}
        <div className="flex items-center gap-2">
          {isLeader ? (
            <span className="rounded-full bg-accent/20 px-2 py-0.5 font-semibold text-accent">
              Stai vincendo
            </span>
          ) : (
            mine && (
              <span className="rounded-full bg-surface-2 px-2 py-0.5 font-medium text-slate-300">
                Partecipi
              </span>
            )
          )}
          <span className="text-accent">Apri ›</span>
        </div>
      </div>
    </Link>
  )
}
