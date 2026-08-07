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

export default function AuctionsPage() {
  const { manager } = useAuth()
  const { data: auctions, isLoading } = useAuctions()
  const { data: players } = usePlayers()
  const { data: managers } = useManagers()
  const { data: myParts } = useMyParticipations()
  const [filter, setFilter] = useState<Filter>('all')

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
    return res
  }, [auctions, filter, myActiveAuctionIds])

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
          icon="🔨"
          title={
            filter === 'mine' ? 'Non partecipi a nessuna asta' : 'Nessuna asta attiva'
          }
          hint={
            filter === 'mine'
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
  const deadline =
    auction.status === 'phase1' ? auction.phase1_ends_at : auction.phase2_ends_at

  return (
    <Link
      to={`/asta/aste/${auction.id}`}
      className="block rounded-2xl border border-border bg-surface p-3.5 active:scale-[0.99]"
    >
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
        {auction.status === 'paused' ? (
          <span className="text-slate-400">In pausa</span>
        ) : (
          <span className="text-slate-400">
            Termina fase tra{' '}
            <Countdown target={deadline} className="font-semibold text-amber-300" />
          </span>
        )}
        <div className="flex items-center gap-2">
          {mine && (
            <span className="rounded-full bg-accent/15 px-2 py-0.5 font-medium text-accent">
              Partecipi
            </span>
          )}
          <span className="text-accent">Apri ›</span>
        </div>
      </div>
    </Link>
  )
}
