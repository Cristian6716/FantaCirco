import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuctions, useCredits, usePlayers, type Auction } from '../lib/queries'
import { PageLoader, RoleBadge, Spinner, StatusBadge } from '../components/ui'
import { useToast } from '../components/Toast'
import { useConfirm } from '../components/Confirm'
import {
  adminCancel,
  adminDelete,
  adminDeleteAll,
  adminPause,
  adminResume,
  createManager,
  deletePlayer,
  importPlayers,
  updateManagerCredits,
  type NewPlayer,
} from '../lib/api'
import { isActive, parseRoles } from '../lib/format'

const inputCls =
  'w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-white outline-none focus:border-accent'

type Tab = 'managers' | 'players' | 'auctions'

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('managers')
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-white">Amministrazione</h1>
      <div className="flex rounded-xl border border-border bg-surface p-1 text-sm">
        <TabBtn active={tab === 'managers'} onClick={() => setTab('managers')}>
          Fantallenatori
        </TabBtn>
        <TabBtn active={tab === 'players'} onClick={() => setTab('players')}>
          Giocatori
        </TabBtn>
        <TabBtn active={tab === 'auctions'} onClick={() => setTab('auctions')}>
          Aste
        </TabBtn>
      </div>
      {tab === 'managers' && <ManagersTab />}
      {tab === 'players' && <PlayersTab />}
      {tab === 'auctions' && <AuctionsTab />}
    </div>
  )
}

function TabBtn({
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

/* ---------------- Fantallenatori ---------------- */

function ManagersTab() {
  const { data: credits, isLoading } = useCredits()
  const qc = useQueryClient()
  const toast = useToast()
  const [showForm, setShowForm] = useState(false)

  if (isLoading) return <PageLoader />

  return (
    <div className="space-y-3">
      <button
        onClick={() => setShowForm((v) => !v)}
        className="w-full rounded-xl bg-accent-strong py-2.5 text-sm font-semibold text-white active:scale-[0.98]"
      >
        {showForm ? 'Chiudi' : '+ Crea account'}
      </button>

      {showForm && <CreateManagerForm onCreated={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ['credits'] }); qc.invalidateQueries({ queryKey: ['managers'] }) }} />}

      <div className="space-y-2">
        {(credits ?? [])
          .slice()
          .sort((a, b) => (a.display_name ?? '').localeCompare(b.display_name ?? ''))
          .map((m) => (
            <ManagerRow
              key={m.id!}
              id={m.id!}
              name={m.display_name ?? '—'}
              username={m.username ?? ''}
              isAdmin={!!m.is_admin}
              total={m.credits_total ?? 0}
              locked={m.locked ?? 0}
              available={m.available ?? 0}
              onSaved={() => {
                qc.invalidateQueries({ queryKey: ['credits'] })
                toast.success('Crediti aggiornati')
              }}
            />
          ))}
      </div>
    </div>
  )
}

function ManagerRow({
  id,
  name,
  username,
  isAdmin,
  total,
  locked,
  available,
  onSaved,
}: {
  id: string
  name: string
  username: string
  isAdmin: boolean
  total: number
  locked: number
  available: number
  onSaved: () => void
}) {
  const toast = useToast()
  const [text, setText] = useState(String(total))
  const [saving, setSaving] = useState(false)
  const parsed = text === '' ? null : parseInt(text, 10)
  const dirty = parsed !== null && parsed !== total

  async function save() {
    if (parsed === null) return
    setSaving(true)
    try {
      await updateManagerCredits(id, parsed)
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="truncate font-medium text-white">
            {name} {isAdmin && <span className="text-xs text-accent">· admin</span>}
          </p>
          <p className="truncate text-xs text-slate-400">@{username}</p>
        </div>
        <div className="text-right text-xs text-slate-400">
          <span className="text-amber-300">{locked}</span> bloccati ·{' '}
          <span className="text-accent">{available}</span> disp.
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="text-xs text-slate-400">Crediti totali</span>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={text}
          onChange={(e) => setText(e.target.value.replace(/\D/g, ''))}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={() => { if (text === '') setText(String(total)) }}
          className="ml-auto h-9 w-24 rounded-lg border border-border bg-surface-2 text-center text-sm font-semibold text-white outline-none focus:border-accent"
        />
        <button
          onClick={save}
          disabled={!dirty || saving}
          className="h-9 rounded-lg bg-accent-strong px-3 text-xs font-semibold text-white disabled:opacity-40"
        >
          {saving ? '…' : 'Salva'}
        </button>
      </div>
    </div>
  )
}

function CreateManagerForm({ onCreated }: { onCreated: () => void }) {
  const toast = useToast()
  const [f, setF] = useState({
    username: '',
    display_name: '',
    team_name: '',
    credits: '',
    password: '',
    is_admin: false,
  })
  const [loading, setLoading] = useState(false)

  async function submit() {
    setLoading(true)
    try {
      await createManager({
        username: f.username,
        display_name: f.display_name,
        team_name: f.team_name || undefined,
        credits: Number(f.credits) || 0,
        password: f.password,
        is_admin: f.is_admin,
      })
      toast.success(`Account «${f.username}» creato`)
      onCreated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-accent/30 bg-surface p-3">
      <input
        className={inputCls}
        placeholder="Username (per il login)"
        autoCapitalize="none"
        value={f.username}
        onChange={(e) => setF({ ...f, username: e.target.value })}
      />
      <input
        className={inputCls}
        placeholder="Nome visualizzato"
        value={f.display_name}
        onChange={(e) => setF({ ...f, display_name: e.target.value })}
      />
      <input
        className={inputCls}
        placeholder="Nome squadra (facoltativo)"
        value={f.team_name}
        onChange={(e) => setF({ ...f, team_name: e.target.value })}
      />
      <div className="flex gap-2">
        <input
          className={inputCls}
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="Crediti"
          value={f.credits}
          onChange={(e) => setF({ ...f, credits: e.target.value.replace(/\D/g, '') })}
        />
        <input
          className={inputCls}
          type="password"
          placeholder="Password iniziale"
          value={f.password}
          onChange={(e) => setF({ ...f, password: e.target.value })}
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-300">
        <input
          type="checkbox"
          checked={f.is_admin}
          onChange={(e) => setF({ ...f, is_admin: e.target.checked })}
          className="h-4 w-4 accent-emerald-500"
        />
        Amministratore
      </label>
      <button
        onClick={submit}
        disabled={loading || !f.username || !f.display_name || !f.password}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent-strong py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {loading ? <Spinner /> : 'Crea account'}
      </button>
    </div>
  )
}

/* ---------------- Giocatori ---------------- */

function parsePlayers(text: string): NewPlayer[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      // Colonne separate da virgola o tab; i ruoli (3a colonna) possono essere
      // multipli es. "Dd/Ds" o "M;C".
      const parts = line.split(/[,\t]/).map((p) => p.trim())
      const name = parts[0]
      const team = parts[1] || null
      const roles = parts[2] ? parseRoles(parts[2]) : []
      return { name, real_team: team, roles }
    })
    .filter((p) => p.name)
}

function PlayersTab() {
  const { data: players, isLoading } = usePlayers()
  const qc = useQueryClient()
  const toast = useToast()
  const confirm = useConfirm()
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)

  const parsed = useMemo(() => parsePlayers(text), [text])

  async function doImport() {
    if (parsed.length === 0) return
    setLoading(true)
    try {
      const n = await importPlayers(parsed)
      toast.success(`${n} giocatori importati`)
      setText('')
      qc.invalidateQueries({ queryKey: ['players'] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    } finally {
      setLoading(false)
    }
  }

  async function remove(id: number, name: string) {
    const ok = await confirm({
      title: 'Eliminare il giocatore?',
      message: name,
      danger: true,
      confirmLabel: 'Elimina',
    })
    if (!ok) return
    try {
      await deletePlayer(id)
      qc.invalidateQueries({ queryKey: ['players'] })
      toast.success('Giocatore eliminato')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  if (isLoading) return <PageLoader />

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-surface p-3">
        <h2 className="text-sm font-semibold text-slate-200">Importa svincolati</h2>
        <p className="mt-1 text-xs text-slate-400">
          Un giocatore per riga: <code className="text-slate-300">Nome, Squadra, Ruoli</code>{' '}
          (ruoli Mantra, anche multipli es. <code className="text-slate-300">Dd/Ds</code> o{' '}
          <code className="text-slate-300">M;C</code>). Squadra e ruoli facoltativi.
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder={'Lautaro Martinez, Inter, A;Pc\nTheo Hernandez, Milan, Ds/E\nBarella, Inter, M;C\n…'}
          className="mt-2 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 font-mono text-xs text-white outline-none focus:border-accent"
        />
        <button
          onClick={doImport}
          disabled={loading || parsed.length === 0}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-accent-strong py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading ? <Spinner /> : `Importa ${parsed.length || ''} giocatori`}
        </button>
      </div>

      <div className="space-y-2">
        {(players ?? []).map((p) => (
          <div key={p.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2">
            <RoleBadge roles={p.roles} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{p.name}</p>
              <p className="truncate text-xs text-slate-400">
                {p.real_team || '—'} · {p.status === 'available' ? 'libero' : p.status === 'in_auction' ? 'in asta' : 'assegnato'}
              </p>
            </div>
            {p.status === 'available' && (
              <button
                onClick={() => remove(p.id, p.name)}
                className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-2.5 py-1.5 text-xs text-rose-200"
              >
                Elimina
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ---------------- Aste ---------------- */

function AuctionsTab() {
  const { data: auctions, isLoading } = useAuctions()
  const { data: players } = usePlayers()
  const qc = useQueryClient()
  const toast = useToast()
  const confirm = useConfirm()

  const playerMap = useMemo(() => new Map((players ?? []).map((p) => [p.id, p])), [players])

  function refresh() {
    qc.invalidateQueries({ queryKey: ['auctions'] })
    qc.invalidateQueries({ queryKey: ['players'] })
    qc.invalidateQueries({ queryKey: ['credits'] })
  }

  async function act(
    label: string,
    fn: () => Promise<void>,
    opts: { title: string; message: string; danger?: boolean; confirmLabel: string },
  ) {
    const ok = await confirm(opts)
    if (!ok) return
    try {
      await fn()
      refresh()
      toast.success(label)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  async function deleteAll() {
    const ok = await confirm({
      title: 'Eliminare TUTTE le aste?',
      message:
        'Verranno cancellate tutte le aste (attive e concluse), i crediti spesi rimborsati e i giocatori rimessi tra gli svincolati. Azione irreversibile.',
      danger: true,
      confirmLabel: 'Elimina tutto',
    })
    if (!ok) return
    try {
      await adminDeleteAll()
      refresh()
      toast.success('Tutte le aste eliminate')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  if (isLoading) return <PageLoader />

  const active = (auctions ?? []).filter((a) => isActive(a.status))
  const closed = (auctions ?? []).filter((a) => !isActive(a.status))

  return (
    <div className="space-y-3">
      {active.length === 0 && closed.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">Nessuna asta.</p>
      ) : (
        <>
          {active.map((a) => (
            <AdminAuctionRow
              key={a.id}
              auction={a}
              playerName={playerMap.get(a.player_id)?.name ?? '—'}
              onPause={() =>
                act('Asta in pausa', () => adminPause(a.id), {
                  title: 'Mettere in pausa?',
                  message: 'I tempi verranno congelati fino alla ripresa.',
                  confirmLabel: 'Pausa',
                })
              }
              onResume={() =>
                act('Asta ripresa', () => adminResume(a.id), {
                  title: 'Riprendere l’asta?',
                  message: 'I tempi ripartiranno da dove erano.',
                  confirmLabel: 'Riprendi',
                })
              }
              onCancel={() =>
                act('Asta annullata', () => adminCancel(a.id), {
                  title: 'Annullare l’asta?',
                  message: 'Nessun vincitore, il giocatore torna libero. I crediti si sbloccano.',
                  danger: true,
                  confirmLabel: 'Annulla asta',
                })
              }
              onDelete={() =>
                act('Asta eliminata', () => adminDelete(a.id), {
                  title: 'Eliminare l’asta?',
                  message: 'L’asta viene rimossa e il giocatore torna libero.',
                  danger: true,
                  confirmLabel: 'Elimina',
                })
              }
            />
          ))}

          {closed.length > 0 && (
            <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Concluse / annullate
            </p>
          )}
          {closed.map((a) => (
            <AdminAuctionRow
              key={a.id}
              auction={a}
              playerName={playerMap.get(a.player_id)?.name ?? '—'}
              onDelete={() =>
                act('Asta eliminata', () => adminDelete(a.id), {
                  title: 'Eliminare l’asta?',
                  message:
                    'Se era assegnata, i crediti vengono rimborsati e il giocatore torna libero.',
                  danger: true,
                  confirmLabel: 'Elimina',
                })
              }
            />
          ))}

          <button
            onClick={deleteAll}
            className="mt-4 w-full rounded-xl border border-rose-500/50 bg-rose-500/10 py-2.5 text-sm font-semibold text-rose-200 active:scale-[0.98]"
          >
            🗑️ Elimina tutte le aste
          </button>
        </>
      )}
    </div>
  )
}

function AdminAuctionRow({
  auction,
  playerName,
  onPause,
  onResume,
  onCancel,
  onDelete,
}: {
  auction: Auction
  playerName: string
  onPause?: () => void
  onResume?: () => void
  onCancel?: () => void
  onDelete: () => void
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate font-medium text-white">{playerName}</p>
        <StatusBadge status={auction.status} />
      </div>
      <p className="mt-1 text-xs text-slate-400">Offerta attuale: {auction.current_bid} crediti</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {auction.status !== 'paused' && onPause && (
          <ActBtn onClick={onPause}>⏸ Pausa</ActBtn>
        )}
        {auction.status === 'paused' && onResume && (
          <ActBtn onClick={onResume}>▶ Riprendi</ActBtn>
        )}
        {onCancel && <ActBtn onClick={onCancel} danger>Annulla</ActBtn>}
        <ActBtn onClick={onDelete} danger>Elimina</ActBtn>
      </div>
    </div>
  )
}

function ActBtn({
  onClick,
  children,
  danger,
}: {
  onClick: () => void
  children: React.ReactNode
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'rounded-lg border px-3 py-1.5 text-xs font-medium active:scale-95',
        danger
          ? 'border-rose-500/40 bg-rose-500/10 text-rose-200'
          : 'border-border bg-surface-2 text-slate-200',
      ].join(' ')}
    >
      {children}
    </button>
  )
}
