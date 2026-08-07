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
import { EmptyState, PageLoader, RoleBadge, StatusBadge } from '../components/ui'
import { formatDateTime, isActive } from '../lib/format'

type Filter = 'all' | 'mine'

/** Chiusura piu' recente in cima (ended_at e' sempre valorizzato da chi chiude l'asta). */
const endedTime = (a: Auction) => (a.ended_at ? new Date(a.ended_at).getTime() : 0)

/**
 * Archivio: tutte le aste chiuse (aggiudicate o annullate). Restano qui per
 * sempre, fuori dalla lista delle attive.
 */
export default function ArchivePage() {
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
  // Qui contano anche le aste da cui mi sono ritirato: sono comunque storia mia.
  const myAuctionIds = useMemo(
    () => new Set((myParts ?? []).map((p) => p.auction_id)),
    [myParts],
  )

  const closed = useMemo(
    () =>
      (auctions ?? [])
        .filter((a) => !isActive(a.status))
        .sort((a, b) => endedTime(b) - endedTime(a)),
    [auctions],
  )

  const list = useMemo(() => {
    let res = closed
    if (filter === 'mine') res = res.filter((a) => myAuctionIds.has(a.id))
    const q = search.trim().toLowerCase()
    if (q) {
      res = res.filter((a) => {
        const p = playerMap.get(a.player_id)
        return (
          (p?.name ?? '').toLowerCase().includes(q) ||
          (p?.real_team ?? '').toLowerCase().includes(q)
        )
      })
    }
    return res
  }, [closed, filter, myAuctionIds, search, playerMap])

  const wonByMe = useMemo(
    () => closed.filter((a) => a.status === 'ended' && a.winner_id === manager?.id),
    [closed, manager?.id],
  )
  const spentByMe = wonByMe.reduce((sum, a) => sum + a.current_bid, 0)

  if (isLoading) return <PageLoader />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-white">Archivio aste</h1>
        <Link to="/asta/aste" className="text-sm text-accent">
          Aste attive ›
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Concluse" value={closed.length} />
        <Stat label="Vinte da te" value={wonByMe.length} accent />
        <Stat label="Crediti spesi" value={spentByMe} />
      </div>

      <div className="flex items-center gap-2">
        <div className="flex rounded-xl border border-border bg-surface p-1">
          <SegBtn active={filter === 'all'} onClick={() => setFilter('all')}>
            Tutte
          </SegBtn>
          <SegBtn active={filter === 'mine'} onClick={() => setFilter('mine')}>
            Le tue
          </SegBtn>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cerca giocatore…"
          className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-accent"
        />
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon="📦"
          title={
            search.trim()
              ? 'Nessun risultato'
              : filter === 'mine'
                ? 'Non hai aste concluse'
                : 'Nessuna asta conclusa'
          }
          hint="Le aste finiscono qui appena si chiudono, in qualsiasi modo."
        />
      ) : (
        <div className="space-y-2.5">
          {list.map((a) => (
            <ArchiveCard
              key={a.id}
              auction={a}
              playerName={playerMap.get(a.player_id)?.name ?? '—'}
              playerRoles={playerMap.get(a.player_id)?.roles ?? []}
              playerTeam={playerMap.get(a.player_id)?.real_team ?? null}
              winnerName={
                a.winner_id ? managerMap.get(a.winner_id)?.display_name ?? '—' : null
              }
              wonByMe={a.winner_id === manager?.id}
              mine={myAuctionIds.has(a.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2 text-center">
      <p className={`text-lg font-bold leading-tight ${accent ? 'text-accent' : 'text-white'}`}>
        {value}
      </p>
      <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
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

function ArchiveCard({
  auction,
  playerName,
  playerRoles,
  playerTeam,
  winnerName,
  wonByMe,
  mine,
}: {
  auction: Auction
  playerName: string
  playerRoles: string[]
  playerTeam: string | null
  winnerName: string | null
  wonByMe: boolean
  mine: boolean
}) {
  const cancelled = auction.status === 'cancelled'
  const assigned = !cancelled && !!winnerName

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
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-slate-400">
            {cancelled ? 'Esito' : assigned ? 'Aggiudicato a' : 'Esito'}
          </p>
          <p
            className={`truncate text-sm font-medium ${wonByMe ? 'text-accent' : 'text-slate-200'}`}
          >
            {cancelled
              ? 'Annullata — nessuna assegnazione'
              : assigned
                ? wonByMe
                  ? 'Tu'
                  : winnerName
                : 'Nessun acquirente'}
          </p>
        </div>
        {!cancelled && assigned && (
          <div className="text-right">
            <p className="text-2xl font-bold leading-none text-white">{auction.current_bid}</p>
            <p className="text-[10px] uppercase tracking-wide text-slate-400">crediti</p>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5 text-xs">
        <span className="text-slate-400">
          {auction.ended_at ? `Chiusa il ${formatDateTime(auction.ended_at)}` : 'Chiusa'}
        </span>
        <div className="flex items-center gap-2">
          {mine && !wonByMe && (
            <span className="rounded-full bg-slate-500/20 px-2 py-0.5 font-medium text-slate-300">
              Partecipavi
            </span>
          )}
          <span className="text-accent">Apri ›</span>
        </div>
      </div>
    </Link>
  )
}
