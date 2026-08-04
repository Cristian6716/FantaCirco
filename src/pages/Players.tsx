import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  useAuctions,
  useManagers,
  useMyCredits,
  usePlayers,
  type Player,
} from '../lib/queries'
import { EmptyState, PageLoader, QtyInput, RoleBadge, Spinner } from '../components/ui'
import { MACRO_LABEL, ROLE_MACRO, type Macro } from '../lib/format'
import { startAuction } from '../lib/api'
import { useToast } from '../components/Toast'
import { buildWhatsappMessage, shareOnWhatsapp } from '../lib/share'

type RoleFilter = 'all' | Macro

export default function PlayersPage() {
  const { data: players, isLoading } = usePlayers()
  const { data: auctions } = useAuctions()
  const { data: managers } = useManagers()
  const [search, setSearch] = useState('')
  const [role, setRole] = useState<RoleFilter>('all')
  const [showTaken, setShowTaken] = useState(false)
  const [target, setTarget] = useState<Player | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const filtersActive = role !== 'all' || showTaken

  const managerMap = useMemo(() => new Map((managers ?? []).map((m) => [m.id, m])), [managers])
  const activeAuctionByPlayer = useMemo(() => {
    const map = new Map<number, number>()
    for (const a of auctions ?? []) {
      if (a.status === 'phase1' || a.status === 'phase2' || a.status === 'paused') {
        map.set(a.player_id, a.id)
      }
    }
    return map
  }, [auctions])

  const list = useMemo(() => {
    let res = players ?? []
    if (!showTaken) res = res.filter((p) => p.status === 'available')
    if (role !== 'all') res = res.filter((p) => p.roles.some((rr) => ROLE_MACRO[rr] === role))
    const q = search.trim().toLowerCase()
    if (q) res = res.filter((p) => p.name.toLowerCase().includes(q) || (p.real_team ?? '').toLowerCase().includes(q))
    return res
  }, [players, role, search, showTaken])

  if (isLoading) return <PageLoader />

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-white">Giocatori svincolati</h1>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Cerca giocatore o squadra…"
        className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-white outline-none focus:border-accent"
      />

      {/* Mobile: un solo bottone che apre il pannello filtri a cascata. */}
      <div className="lg:hidden">
        <button
          onClick={() => setFiltersOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium text-white active:scale-[0.99]"
        >
          <span className="flex items-center gap-2">
            Filtri
            {filtersActive && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
          </span>
          <span className={`text-xs text-slate-400 transition-transform ${filtersOpen ? 'rotate-180' : ''}`}>▾</span>
        </button>
        {filtersOpen && (
          <div className="mt-2 space-y-2 rounded-xl border border-border bg-surface p-3">
            <div className="flex flex-wrap gap-1.5">
              {(['all', 'P', 'D', 'C', 'A'] as RoleFilter[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  className={[
                    'rounded-lg border px-3 py-1.5 text-xs font-medium',
                    role === r
                      ? 'border-accent/60 bg-accent/15 text-accent'
                      : 'border-border bg-surface-2 text-slate-400',
                  ].join(' ')}
                >
                  {r === 'all' ? 'Tutti' : MACRO_LABEL[r]}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowTaken((v) => !v)}
              className={[
                'w-full rounded-lg border px-3 py-1.5 text-xs font-medium',
                showTaken
                  ? 'border-sky-500/50 bg-sky-500/15 text-sky-200'
                  : 'border-border bg-surface-2 text-slate-400',
              ].join(' ')}
            >
              {showTaken ? 'Mostra solo liberi' : 'Mostra anche assegnati'}
            </button>
          </div>
        )}
      </div>

      {/* Desktop: fila di chip, spazio a sufficienza per mostrarle tutte. */}
      <div className="hidden items-center gap-1.5 overflow-x-auto pb-0.5 lg:flex">
        {(['all', 'P', 'D', 'C', 'A'] as RoleFilter[]).map((r) => (
          <button
            key={r}
            onClick={() => setRole(r)}
            className={[
              'shrink-0 whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-medium',
              role === r
                ? 'border-accent/60 bg-accent/15 text-accent'
                : 'border-border bg-surface text-slate-400',
            ].join(' ')}
          >
            {r === 'all' ? 'Tutti' : MACRO_LABEL[r]}
          </button>
        ))}
        <button
          onClick={() => setShowTaken((v) => !v)}
          className={[
            'ml-auto shrink-0 whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-medium',
            showTaken
              ? 'border-sky-500/50 bg-sky-500/15 text-sky-200'
              : 'border-border bg-surface text-slate-400',
          ].join(' ')}
        >
          {showTaken ? 'Tutti' : 'Solo liberi'}
        </button>
      </div>

      {list.length === 0 ? (
        <EmptyState icon="📋" title="Nessun giocatore" hint="L'admin importa gli svincolati dal pannello." />
      ) : (
        <div className="space-y-2">
          {list.map((p) => (
            <PlayerRow
              key={p.id}
              player={p}
              assignedToName={p.assigned_to ? managerMap.get(p.assigned_to)?.display_name ?? '—' : null}
              activeAuctionId={activeAuctionByPlayer.get(p.id)}
              onStart={() => setTarget(p)}
            />
          ))}
        </div>
      )}

      {target && <StartAuctionModal player={target} onClose={() => setTarget(null)} />}
    </div>
  )
}

function PlayerRow({
  player,
  assignedToName,
  activeAuctionId,
  onStart,
}: {
  player: Player
  assignedToName: string | null
  activeAuctionId?: number
  onStart: () => void
}) {
  const navigate = useNavigate()
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5">
      <RoleBadge roles={player.roles} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-white">{player.name}</p>
        {player.real_team && <p className="truncate text-xs text-slate-400">{player.real_team}</p>}
      </div>
      {player.status === 'available' && (
        <button
          onClick={onStart}
          className="rounded-lg bg-accent-strong px-3 py-1.5 text-sm font-semibold text-white active:scale-95"
        >
          Avvia
        </button>
      )}
      {player.status === 'in_auction' && activeAuctionId && (
        <button
          onClick={() => navigate(`/asta/aste/${activeAuctionId}`)}
          className="rounded-lg border border-amber-500/50 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-200"
        >
          In asta ›
        </button>
      )}
      {player.status === 'assigned' && (
        <span className="text-xs text-slate-400">a {assignedToName}</span>
      )}
    </div>
  )
}

function StartAuctionModal({ player, onClose }: { player: Player; onClose: () => void }) {
  const credits = useMyCredits()
  const toast = useToast()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [base, setBase] = useState(1)
  const [loading, setLoading] = useState(false)
  const [created, setCreated] = useState<{ id: number; phase1EndsAt: string } | null>(null)

  const available = credits?.available ?? 0
  const tooHigh = base > available
  const invalid = base < 1 || tooHigh

  async function onConfirm() {
    setLoading(true)
    try {
      const id = await startAuction(player.id, base)
      qc.invalidateQueries({ queryKey: ['auctions'] })
      qc.invalidateQueries({ queryKey: ['players'] })
      qc.invalidateQueries({ queryKey: ['credits'] })
      // recupera la scadenza fase 1 per il messaggio (now + 24h ~). Usiamo l'orario stimato dal server al refetch.
      const phase1EndsAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString()
      setCreated({ id, phase1EndsAt })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    } finally {
      setLoading(false)
    }
  }

  function share() {
    if (!created) return
    const msg = buildWhatsappMessage({
      playerName: player.name,
      team: player.real_team,
      base,
      auctionId: created.id,
      phase1EndsAt: created.phase1EndsAt,
    })
    shareOnWhatsapp(msg)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-2xl border border-border bg-surface p-5 pb-safe sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {!created ? (
          <>
            <div className="flex items-center gap-3">
              <RoleBadge roles={player.roles} />
              <div>
                <h3 className="text-lg font-semibold text-white">{player.name}</h3>
                {player.real_team && <p className="text-xs text-slate-400">{player.real_team}</p>}
              </div>
            </div>

            <p className="mt-4 text-sm text-slate-300">
              Offerta base di apertura (sarai tu il primo in testa):
            </p>
            <div className="mt-2">
              <QtyInput value={base} onChange={setBase} min={1} />
            </div>
            <p className={`mt-2 text-xs ${tooHigh ? 'text-rose-300' : 'text-slate-400'}`}>
              Crediti disponibili: {available}
            </p>

            <div className="mt-5 flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 rounded-xl border border-border bg-surface-2 py-2.5 text-sm font-medium text-slate-200"
              >
                Annulla
              </button>
              <button
                onClick={onConfirm}
                disabled={invalid || loading}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent-strong py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {loading ? <Spinner /> : 'Avvia asta'}
              </button>
            </div>
          </>
        ) : (
          <div className="text-center">
            <div className="text-4xl">✅</div>
            <h3 className="mt-2 text-lg font-semibold text-white">Asta avviata!</h3>
            <p className="mt-1 text-sm text-slate-300">
              {player.name} — base {base} crediti. Avvisa il gruppo su WhatsApp.
            </p>
            <button
              onClick={share}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] py-2.5 font-semibold text-black active:scale-[0.98]"
            >
              💬 Condividi su WhatsApp
            </button>
            <button
              onClick={() => navigate(`/asta/aste/${created.id}`)}
              className="mt-2 w-full rounded-xl bg-accent-strong py-2.5 font-semibold text-white active:scale-[0.98]"
            >
              Vai all'asta
            </button>
            <button onClick={onClose} className="mt-2 w-full py-2 text-sm text-slate-400">
              Chiudi
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
