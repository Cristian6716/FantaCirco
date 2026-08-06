import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthProvider'
import {
  useAuction,
  useBids,
  useManagers,
  useMyAutobid,
  useMyCredits,
  useParticipants,
  usePlayers,
} from '../lib/queries'
import { Countdown, PageLoader, QtyInput, RoleBadge, Spinner, StatusBadge } from '../components/ui'
import { formatDateTime, formatTime, isActive } from '../lib/format'
import { cancelAutobid, placeBid, setAutobid, withdraw } from '../lib/api'
import { useToast } from '../components/Toast'
import { useConfirm } from '../components/Confirm'
import { auctionUrl, shareOnWhatsapp } from '../lib/share'

export default function AuctionDetailPage() {
  const params = useParams()
  const id = Number(params.id)
  const navigate = useNavigate()
  const { manager } = useAuth()
  const { data: auction, isLoading } = useAuction(id)
  const { data: players } = usePlayers()
  const { data: managers } = useManagers()
  const { data: bids } = useBids(id)
  const { data: participants } = useParticipants(id)
  const { data: myAutobid } = useMyAutobid(id)
  const credits = useMyCredits()

  const managerMap = useMemo(() => new Map((managers ?? []).map((m) => [m.id, m])), [managers])
  const player = useMemo(
    () => (players ?? []).find((p) => p.id === auction?.player_id),
    [players, auction?.player_id],
  )
  const myPart = useMemo(
    () => (participants ?? []).find((p) => p.manager_id === manager?.id),
    [participants, manager?.id],
  )

  if (isLoading) return <PageLoader />
  if (!auction) {
    return (
      <div className="py-20 text-center text-slate-400">
        Asta non trovata.
        <div>
          <button onClick={() => navigate('/asta/aste')} className="mt-3 text-accent">
            ‹ Torna alle aste
          </button>
        </div>
      </div>
    )
  }

  const isLeader = auction.leader_id === manager?.id
  const active = isActive(auction.status)
  const withdrawn = !!myPart?.withdrawn
  const eligiblePhase2 = auction.status !== 'phase2' || !!myPart?.joined_in_phase1
  const leaderName = auction.leader_id
    ? managerMap.get(auction.leader_id)?.display_name ?? '—'
    : '—'

  return (
    <div className="space-y-4">
      <button onClick={() => navigate('/asta/aste')} className="text-sm text-slate-400">
        ‹ Aste
      </button>

      {/* Header giocatore */}
      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <RoleBadge roles={player?.roles ?? []} />
            <div>
              <h1 className="text-xl font-bold text-white">{player?.name ?? '—'}</h1>
              {player?.real_team && <p className="text-sm text-slate-400">{player.real_team}</p>}
            </div>
          </div>
          <StatusBadge status={auction.status} />
        </div>

        <div className="mt-4 flex items-end justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-slate-400">
              {active ? 'In testa' : auction.status === 'ended' ? 'Aggiudicato a' : 'Annullata'}
            </p>
            <p className={`text-lg font-semibold ${isLeader ? 'text-accent' : 'text-white'}`}>
              {isLeader ? 'Tu' : leaderName}
            </p>
          </div>
          <div className="text-right">
            <p className="text-4xl font-black leading-none text-white">{auction.current_bid}</p>
            <p className="text-[10px] uppercase tracking-wide text-slate-400">crediti</p>
          </div>
        </div>

        {/* Fasi / countdown */}
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <PhaseBox
            label="Fase 1 · tutti"
            ends={auction.phase1_ends_at}
            activeNow={auction.status === 'phase1'}
            done={auction.status !== 'phase1' && auction.status !== 'paused'}
          />
          <PhaseBox
            label="Fase 2 · partecipanti"
            ends={auction.phase2_ends_at}
            activeNow={auction.status === 'phase2'}
            done={!isActive(auction.status)}
          />
        </div>
        {auction.status === 'paused' && (
          <p className="mt-3 rounded-lg border border-slate-500/40 bg-slate-500/10 px-3 py-2 text-center text-xs text-slate-300">
            ⏸️ Asta in pausa dall'amministratore
          </p>
        )}

        <button
          onClick={() =>
            shareOnWhatsapp(
              `🔨 Asta per *${player?.name}*: offerta attuale ${auction.current_bid} crediti.\nPartecipa 👉 ${auctionUrl(auction.id)}`,
            )
          }
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-[#25D366]/50 bg-[#25D366]/10 py-2 text-sm font-semibold text-[#25D366]"
        >
          💬 Condividi su WhatsApp
        </button>
      </div>

      {/* Azioni */}
      {active && auction.status !== 'paused' && (
        <>
          {isLeader ? (
            <div className="rounded-2xl border border-accent/40 bg-accent/10 p-4 text-center text-sm text-accent">
              🥇 Sei in testa! Non puoi rilanciare su te stesso.
              <div className="mt-3">
                <AutobidPanel auctionId={auction.id} currentBid={auction.current_bid} myMax={myAutobid?.max_amount ?? null} isLeader />
              </div>
            </div>
          ) : withdrawn ? (
            <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-center text-sm text-rose-200">
              Ti sei ritirato da questa asta.
            </div>
          ) : !eligiblePhase2 ? (
            <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-center text-sm text-amber-200">
              Sei nella fase 2: possono rilanciare solo i fantallenatori che hanno partecipato alla fase 1.
            </div>
          ) : (
            <>
              <BidPanel
                auctionId={auction.id}
                minBid={auction.current_bid + 1}
                available={credits?.available ?? 0}
              />
              <AutobidPanel
                auctionId={auction.id}
                currentBid={auction.current_bid}
                myMax={myAutobid?.max_amount ?? null}
              />
              {myPart && (
                <WithdrawButton auctionId={auction.id} playerName={player?.name ?? ''} />
              )}
            </>
          )}
        </>
      )}

      {auction.status === 'ended' && (
        <div className="rounded-2xl border border-sky-500/40 bg-sky-500/10 p-4 text-center text-sm text-sky-100">
          🏁 Asta conclusa: <b>{leaderName}</b> si aggiudica <b>{player?.name}</b> per{' '}
          <b>{auction.current_bid}</b> crediti.
        </div>
      )}

      {/* Storico offerte */}
      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-300">Storico offerte</h2>
        <div className="space-y-1.5">
          {(bids ?? []).length === 0 && (
            <p className="text-sm text-slate-500">Nessuna offerta.</p>
          )}
          {(bids ?? []).map((b) => {
            const name = managerMap.get(b.manager_id)?.display_name ?? '—'
            const mine = b.manager_id === manager?.id
            return (
              <div
                key={b.id}
                className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-2">
                  <span className={mine ? 'font-semibold text-accent' : 'text-slate-200'}>
                    {mine ? 'Tu' : name}
                  </span>
                  {b.is_auto && (
                    <span className="rounded bg-slate-600/40 px-1.5 py-0.5 text-[10px] text-slate-300">
                      auto
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-white">{b.amount}</span>
                  <span className="text-xs text-slate-500">{formatTime(b.created_at)}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <p className="pt-2 text-center text-[11px] text-slate-600">
        Avviata il {formatDateTime(auction.started_at)}
      </p>
    </div>
  )
}

function PhaseBox({
  label,
  ends,
  activeNow,
  done,
}: {
  label: string
  ends: string
  activeNow: boolean
  done: boolean
}) {
  return (
    <div
      className={[
        'rounded-xl border px-3 py-2',
        activeNow ? 'border-amber-500/50 bg-amber-500/10' : 'border-border bg-surface-2',
      ].join(' ')}
    >
      <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
      {activeNow ? (
        <p className="font-semibold text-amber-300">
          <Countdown target={ends} />
        </p>
      ) : done ? (
        <p className="text-slate-500">conclusa</p>
      ) : (
        <p className="text-slate-400">{formatDateTime(ends)}</p>
      )}
    </div>
  )
}

function BidPanel({
  auctionId,
  minBid,
  available,
}: {
  auctionId: number
  minBid: number
  available: number
}) {
  const toast = useToast()
  const qc = useQueryClient()
  const [amount, setAmount] = useState(minBid)
  const [loading, setLoading] = useState(false)

  // Mantieni l'importo allineato al minimo quando l'asta sale
  useEffect(() => {
    setAmount((a) => (a < minBid ? minBid : a))
  }, [minBid])

  const tooHigh = amount > available
  const invalid = amount < minBid || tooHigh

  async function onBid() {
    setLoading(true)
    try {
      await placeBid(auctionId, amount)
      qc.invalidateQueries({ queryKey: ['auction', auctionId] })
      qc.invalidateQueries({ queryKey: ['bids', auctionId] })
      qc.invalidateQueries({ queryKey: ['credits'] })
      toast.success('Offerta piazzata!')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-200">Rilancia</h2>
        <span className="text-xs text-slate-400">min {minBid} · disp. {available}</span>
      </div>
      <div className="mt-3">
        <QtyInput value={amount} onChange={setAmount} min={minBid} />
      </div>
      <div className="mt-2 flex gap-1.5">
        {[1, 5, 10].map((inc) => (
          <button
            key={inc}
            onClick={() => setAmount(minBid - 1 + inc)}
            className="flex-1 rounded-lg border border-border bg-surface-2 py-1.5 text-xs text-slate-300"
          >
            +{inc}
          </button>
        ))}
      </div>
      {tooHigh && <p className="mt-2 text-xs text-rose-300">Crediti insufficienti.</p>}
      <button
        onClick={onBid}
        disabled={invalid || loading}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-accent-strong py-3 font-semibold text-white active:scale-[0.98] disabled:opacity-50"
      >
        {loading ? <Spinner /> : `Offri ${amount}`}
      </button>
    </div>
  )
}

function AutobidPanel({
  auctionId,
  currentBid,
  myMax,
  isLeader,
}: {
  auctionId: number
  currentBid: number
  myMax: number | null
  isLeader?: boolean
}) {
  const toast = useToast()
  const confirm = useConfirm()
  const qc = useQueryClient()
  const credits = useMyCredits()
  const [open, setOpen] = useState(false)
  const minMax = isLeader ? currentBid : currentBid + 1
  const [max, setMax] = useState(Math.max(minMax, myMax ?? minMax))
  const [loading, setLoading] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  function refresh() {
    qc.invalidateQueries({ queryKey: ['autobid', auctionId] })
    qc.invalidateQueries({ queryKey: ['auction', auctionId] })
    qc.invalidateQueries({ queryKey: ['bids', auctionId] })
    qc.invalidateQueries({ queryKey: ['credits'] })
  }

  async function onSet() {
    setLoading(true)
    try {
      await setAutobid(auctionId, max)
      refresh()
      toast.success('Auto-bid impostato!')
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    } finally {
      setLoading(false)
    }
  }

  async function onCancel() {
    const ok = await confirm({
      title: 'Rimuovere l’auto-bid?',
      message: 'Non rilancerà più automaticamente per te su questa asta.',
      confirmLabel: 'Rimuovi',
      danger: true,
    })
    if (!ok) return
    setCancelling(true)
    try {
      await cancelAutobid(auctionId)
      refresh()
      toast.success('Auto-bid rimosso')
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-200">Auto-bid 🤖</h2>
          {myMax != null ? (
            <p className="text-xs text-accent">Tetto attuale: {myMax} crediti</p>
          ) : (
            <p className="text-xs text-slate-400">Rilancia da solo di +1 fino al tuo tetto</p>
          )}
        </div>
        {!open && (
          <div className="flex gap-1.5">
            {myMax != null && (
              <button
                onClick={onCancel}
                disabled={cancelling}
                className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-200 disabled:opacity-50"
              >
                {cancelling ? '…' : 'Rimuovi'}
              </button>
            )}
            <button
              onClick={() => {
                setMax(Math.max(minMax, myMax ?? minMax))
                setOpen(true)
              }}
              className="rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-slate-200"
            >
              {myMax != null ? 'Modifica' : 'Imposta'}
            </button>
          </div>
        )}
      </div>

      {open && (
        <>
          <div className="mt-3">
            <QtyInput value={max} onChange={setMax} min={minMax} size="md" />
          </div>
          <p className="mt-1.5 text-xs text-slate-400">
            Min {minMax} · disponibili {credits?.available ?? 0}
            {isLeader ? ' (sei in testa: non può scendere sotto l’offerta attuale)' : ''}.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => setOpen(false)}
              className="flex-1 rounded-xl border border-border bg-surface-2 py-2.5 text-sm text-slate-200"
            >
              Annulla
            </button>
            <button
              onClick={onSet}
              disabled={loading || max < minMax}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent-strong py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {loading ? <Spinner /> : 'Conferma'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function WithdrawButton({ auctionId, playerName }: { auctionId: number; playerName: string }) {
  const toast = useToast()
  const confirm = useConfirm()
  const qc = useQueryClient()
  const [loading, setLoading] = useState(false)

  async function onWithdraw() {
    const ok = await confirm({
      title: 'Ritirarsi dall’asta?',
      message: `Non potrai più rilanciare per ${playerName}. L'azione è definitiva.`,
      confirmLabel: 'Ritirati',
      danger: true,
    })
    if (!ok) return
    setLoading(true)
    try {
      await withdraw(auctionId)
      qc.invalidateQueries({ queryKey: ['auction', auctionId] })
      qc.invalidateQueries({ queryKey: ['participants', auctionId] })
      qc.invalidateQueries({ queryKey: ['my-participations'] })
      toast.success('Ti sei ritirato.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={onWithdraw}
      disabled={loading}
      className="w-full rounded-xl border border-rose-500/40 bg-rose-500/10 py-2.5 text-sm font-medium text-rose-200 active:scale-[0.98] disabled:opacity-50"
    >
      {loading ? 'Attendere…' : 'Ritirati dall’asta'}
    </button>
  )
}
