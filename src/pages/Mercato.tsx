import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useManagers, usePlayers, type Player } from '../lib/queries'
import {
  useEliminaAnnuncio,
  useMercato,
  useSalvaAnnuncio,
  type MercatoAnnuncio,
  type Preferenza,
} from '../lib/mercato'
import { EmptyState, PageLoader, QtyInput, RoleBadge, Spinner } from '../components/ui'
import {
  MACRO_LABEL,
  MANTRA_ROLES,
  ROLE_MACRO,
  formatDateTime,
  roleRank,
  type MantraRole,
  type Macro,
} from '../lib/format'
import { useConfirm } from '../components/Confirm'
import { useToast } from '../components/Toast'

type RoleFilter = 'all' | Macro

const MACRO_ORDER: Macro[] = ['P', 'D', 'C', 'A']
const RUOLI_PER_MACRO: Record<Macro, MantraRole[]> = {
  P: MANTRA_ROLES.filter((r) => ROLE_MACRO[r] === 'P'),
  D: MANTRA_ROLES.filter((r) => ROLE_MACRO[r] === 'D'),
  C: MANTRA_ROLES.filter((r) => ROLE_MACRO[r] === 'C'),
  A: MANTRA_ROLES.filter((r) => ROLE_MACRO[r] === 'A'),
}

/** Bacheca degli scambi: chi cede cosa e cosa vuole in cambio. */
export default function MercatoPage() {
  const { manager } = useAuth()
  const { data: players, isLoading: loadingPlayers } = usePlayers()
  const { data: managers } = useManagers()
  const { data: annunci, isLoading: loadingAnnunci } = useMercato()

  const [role, setRole] = useState<RoleFilter>('all')
  const [team, setTeam] = useState<string>('all')
  const [soloMiei, setSoloMiei] = useState(false)
  const [picking, setPicking] = useState(false)
  const [editing, setEditing] = useState<{ player: Player; annuncio: MercatoAnnuncio | null } | null>(
    null,
  )

  const playerMap = useMemo(() => new Map((players ?? []).map((p) => [p.id, p])), [players])
  const managerMap = useMemo(() => new Map((managers ?? []).map((m) => [m.id, m])), [managers])
  const annunciByPlayer = useMemo(() => new Map((annunci ?? []).map((a) => [a.player_id, a])), [annunci])

  // Un annuncio il cui giocatore non è in cache non è mostrabile: lo salto.
  const rows = useMemo(
    () =>
      (annunci ?? []).flatMap((a) => {
        const player = playerMap.get(a.player_id)
        return player ? [{ annuncio: a, player }] : []
      }),
    [annunci, playerMap],
  )

  const filtered = useMemo(() => {
    let res = rows
    if (soloMiei) res = res.filter((r) => r.annuncio.manager_id === manager?.id)
    if (team !== 'all') res = res.filter((r) => r.annuncio.manager_id === team)
    if (role !== 'all') res = res.filter((r) => r.player.roles.some((x) => ROLE_MACRO[x] === role))
    return res
  }, [rows, soloMiei, team, role, manager?.id])

  // La mia rosa senza chi è già in vetrina: sono i candidati da aggiungere.
  const miaRosa = useMemo(() => {
    if (!manager) return []
    return (players ?? [])
      .filter(
        (p) => p.status === 'assigned' && p.assigned_to === manager.id && !annunciByPlayer.has(p.id),
      )
      .sort((a, b) => roleRank(a.roles) - roleRank(b.roles) || a.name.localeCompare(b.name, 'it'))
  }, [players, manager, annunciByPlayer])

  // Solo le squadre con almeno un annuncio: filtrare sul vuoto non serve.
  const squadreConAnnunci = useMemo(() => {
    const ids = new Set(rows.map((r) => r.annuncio.manager_id))
    return [...ids]
      .map((id) => ({
        id,
        name: managerMap.get(id)?.team_name ?? managerMap.get(id)?.display_name ?? '—',
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'it'))
  }, [rows, managerMap])

  if (loadingPlayers || loadingAnnunci) return <PageLoader />

  const mieiCount = rows.filter((r) => r.annuncio.manager_id === manager?.id).length

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-white">Mercato</h1>
        <p className="mt-1 text-sm text-slate-400">
          Metti in vetrina i giocatori che cedi e scrivi cosa vuoi in cambio. Lo scambio vero lo
          registra poi l&apos;admin.
        </p>
      </div>

      <button
        onClick={() => setPicking(true)}
        className="w-full rounded-xl bg-accent-strong px-4 py-3 text-sm font-semibold text-white active:scale-[0.99]"
      >
        ➕ Aggiungi giocatore
      </button>

      {rows.length > 0 && (
        <div className="space-y-2">
          {/* Griglia fissa, niente striscia scrollabile: su mobile le etichette
              estese non ci stanno e la riga scorrerebbe sotto il dito. */}
          <div className="grid grid-cols-5 gap-1.5">
            {(['all', 'P', 'D', 'C', 'A'] as RoleFilter[]).map((r) => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={[
                  'truncate rounded-lg border px-2 py-1.5 text-xs font-medium',
                  role === r
                    ? 'border-accent/60 bg-accent/15 text-accent'
                    : 'border-border bg-surface text-slate-400',
                ].join(' ')}
              >
                <span className="lg:hidden">{r === 'all' ? 'Tutti' : r}</span>
                <span className="hidden lg:inline">{r === 'all' ? 'Tutti' : MACRO_LABEL[r]}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <select
              value={team}
              onChange={(e) => setTeam(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-white outline-none focus:border-accent"
            >
              <option value="all">Tutte le squadre</option>
              {squadreConAnnunci.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => setSoloMiei((v) => !v)}
              disabled={mieiCount === 0}
              className={[
                'shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-40',
                soloMiei
                  ? 'border-accent/60 bg-accent/15 text-accent'
                  : 'border-border bg-surface text-slate-400',
              ].join(' ')}
            >
              I miei ({mieiCount})
            </button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon="🤝"
          title={rows.length === 0 ? 'Vetrina vuota' : 'Nessun annuncio con questi filtri'}
          hint={
            rows.length === 0
              ? 'Aggiungi un giocatore della tua rosa e scrivi cosa vuoi in cambio.'
              : undefined
          }
        />
      ) : (
        <div className="space-y-2">
          {filtered.map(({ annuncio, player }) => (
            <AnnuncioCard
              key={annuncio.id}
              annuncio={annuncio}
              player={player}
              team={
                managerMap.get(annuncio.manager_id)?.team_name ??
                managerMap.get(annuncio.manager_id)?.display_name ??
                '—'
              }
              isMine={annuncio.manager_id === manager?.id}
              onEdit={() => setEditing({ player, annuncio })}
            />
          ))}
        </div>
      )}

      {picking && (
        <ScegliGiocatoreModal
          rosa={miaRosa}
          onClose={() => setPicking(false)}
          onPick={(p) => {
            setPicking(false)
            setEditing({ player: p, annuncio: null })
          }}
        />
      )}

      {editing && manager && (
        <AnnuncioModal
          player={editing.player}
          annuncio={editing.annuncio}
          managerId={manager.id}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function Chip({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate' | 'amber' | 'sky' }) {
  const styles = {
    slate: 'border-border bg-surface-2 text-slate-300',
    amber: 'border-amber-500/40 bg-amber-500/15 text-amber-200',
    sky: 'border-sky-500/40 bg-sky-500/15 text-sky-200',
  }
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${styles[tone]}`}>
      {children}
    </span>
  )
}

function AnnuncioCard({
  annuncio,
  player,
  team,
  isMine,
  onEdit,
}: {
  annuncio: MercatoAnnuncio
  player: Player
  team: string
  isMine: boolean
  onEdit: () => void
}) {
  const elimina = useEliminaAnnuncio()
  const confirm = useConfirm()
  const toast = useToast()

  const onDelete = async () => {
    const ok = await confirm({
      title: 'Togliere dalla vetrina?',
      message: `${player.name} non sarà più mostrato sul mercato.`,
      confirmLabel: 'Togli',
      danger: true,
    })
    if (!ok) return
    try {
      await elimina.mutateAsync(annuncio.id)
      toast.success('Annuncio rimosso')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Errore')
    }
  }

  const nessunaRichiesta =
    annuncio.ruoli.length === 0 && !annuncio.preferenza && !annuncio.accetta_crediti && !annuncio.nota

  return (
    <div className={['rounded-xl border bg-surface p-3', isMine ? 'border-accent/40' : 'border-border'].join(' ')}>
      <div className="flex items-center gap-3">
        <RoleBadge roles={player.roles} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-white">{player.name}</p>
          <p className="truncate text-xs text-slate-400">
            {player.real_team ? `${player.real_team} · ` : ''}
            {team}
          </p>
        </div>
        {isMine && (
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              onClick={onEdit}
              className="rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-xs font-medium text-slate-200 active:scale-95"
            >
              Modifica
            </button>
            <button
              onClick={onDelete}
              disabled={elimina.isPending}
              aria-label="Togli dalla vetrina"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface-2 text-sm text-rose-300 active:scale-95 disabled:opacity-50"
            >
              {elimina.isPending ? <Spinner className="h-4 w-4" /> : '✕'}
            </button>
          </div>
        )}
      </div>

      <div className="mt-2.5 border-t border-border pt-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">In cambio</p>
        {nessunaRichiesta ? (
          <p className="mt-1 text-sm text-slate-400">Aperto a qualsiasi proposta.</p>
        ) : (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {annuncio.ruoli.length > 0 && <RoleBadge roles={annuncio.ruoli} />}
            {annuncio.preferenza && (
              <Chip tone="sky">{annuncio.preferenza === 'qualita' ? '💎 Qualità' : '📦 Quantità'}</Chip>
            )}
            {annuncio.accetta_crediti && (
              <Chip tone="amber">
                💰 Crediti{annuncio.crediti_min ? ` (min ${annuncio.crediti_min})` : ''}
              </Chip>
            )}
          </div>
        )}
        {annuncio.nota && <p className="mt-2 text-sm italic text-slate-300">«{annuncio.nota}»</p>}
      </div>

      <p className="mt-2 text-[10px] text-slate-500">Aggiornato il {formatDateTime(annuncio.updated_at)}</p>
    </div>
  )
}

function ModalShell({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  // Con la modale aperta la pagina sotto non deve scorrere: su mobile lo
  // scroll "passa" al fondo e sembra che la schermata si muova da sola.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        // dvh e non vh: su mobile la barra del browser che compare e sparisce
        // cambia l'altezza e il pannello salterebbe.
        className="flex max-h-[85dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-border bg-surface pb-safe shadow-2xl sm:rounded-2xl sm:pb-0"
      >
        {children}
      </div>
    </div>
  )
}

function ScegliGiocatoreModal({
  rosa,
  onClose,
  onPick,
}: {
  rosa: Player[]
  onClose: () => void
  onPick: (p: Player) => void
}) {
  const [search, setSearch] = useState('')
  const q = search.trim().toLowerCase()
  const list = q
    ? rosa.filter(
        (p) => p.name.toLowerCase().includes(q) || (p.real_team ?? '').toLowerCase().includes(q),
      )
    : rosa

  return (
    <ModalShell onClose={onClose}>
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">Chi metti in vetrina?</h3>
          <button onClick={onClose} aria-label="Chiudi" className="text-lg text-slate-400">
            ✕
          </button>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cerca nella tua rosa…"
          className="mt-2 w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-white outline-none focus:border-accent"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {list.length === 0 ? (
          <EmptyState
            icon="🧍"
            title={rosa.length === 0 ? 'Nessun giocatore da aggiungere' : 'Nessun risultato'}
            hint={rosa.length === 0 ? 'Sono già tutti in vetrina, o la tua rosa è vuota.' : undefined}
          />
        ) : (
          <div className="space-y-1.5">
            {list.map((p) => (
              <button
                key={p.id}
                onClick={() => onPick(p)}
                className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-left active:scale-[0.99]"
              >
                <RoleBadge roles={p.roles} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-white">{p.name}</span>
                  {p.real_team && (
                    <span className="block truncate text-xs text-slate-400">{p.real_team}</span>
                  )}
                </span>
                {p.price != null && <span className="shrink-0 text-xs text-slate-400">{p.price} cr</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </ModalShell>
  )
}

function AnnuncioModal({
  player,
  annuncio,
  managerId,
  onClose,
}: {
  player: Player
  annuncio: MercatoAnnuncio | null
  managerId: string
  onClose: () => void
}) {
  const salva = useSalvaAnnuncio()
  const toast = useToast()
  const [ruoli, setRuoli] = useState<string[]>(annuncio?.ruoli ?? [])
  const [preferenza, setPreferenza] = useState<Preferenza | null>(
    (annuncio?.preferenza as Preferenza | null) ?? null,
  )
  const [accettaCrediti, setAccettaCrediti] = useState(annuncio?.accetta_crediti ?? false)
  const [creditiMin, setCreditiMin] = useState(annuncio?.crediti_min ?? 0)
  const [nota, setNota] = useState(annuncio?.nota ?? '')

  const toggleRuolo = (r: string) =>
    setRuoli((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]))

  const onSubmit = async () => {
    try {
      await salva.mutateAsync({
        playerId: player.id,
        managerId,
        // Ordine del listone, così i badge escono sempre nella stessa sequenza.
        ruoli: [...ruoli].sort(
          (a, b) =>
            MANTRA_ROLES.indexOf(a as MantraRole) - MANTRA_ROLES.indexOf(b as MantraRole),
        ),
        preferenza,
        accettaCrediti,
        creditiMin: accettaCrediti && creditiMin > 0 ? creditiMin : null,
        nota: nota.trim() || null,
      })
      toast.success(annuncio ? 'Annuncio aggiornato' : `${player.name} è in vetrina`)
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Errore')
    }
  }

  return (
    <ModalShell onClose={onClose}>
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <RoleBadge roles={player.roles} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-white">{player.name}</p>
          {player.real_team && <p className="truncate text-xs text-slate-400">{player.real_team}</p>}
        </div>
        <button onClick={onClose} aria-label="Chiudi" className="text-lg text-slate-400">
          ✕
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <div>
          <p className="text-sm font-semibold text-white">Che ruoli cerchi?</p>
          <p className="text-xs text-slate-400">Nessuna scelta = qualsiasi ruolo va bene.</p>
          <div className="mt-2 space-y-2">
            {MACRO_ORDER.map((macro) => (
              <div key={macro} className="flex items-start gap-2">
                <span className="w-24 shrink-0 pt-1.5 text-xs text-slate-400">{MACRO_LABEL[macro]}</span>
                <div className="flex flex-wrap gap-1.5">
                  {RUOLI_PER_MACRO[macro].map((r) => {
                    const on = ruoli.includes(r)
                    return (
                      <button
                        key={r}
                        onClick={() => toggleRuolo(r)}
                        className={[
                          'rounded-lg border px-2.5 py-1 text-xs font-semibold',
                          on
                            ? 'border-accent/60 bg-accent/15 text-accent'
                            : 'border-border bg-surface-2 text-slate-400',
                        ].join(' ')}
                      >
                        {r}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-white">Quantità o qualità?</p>
          <div className="mt-2 flex gap-1.5">
            {([null, 'quantita', 'qualita'] as (Preferenza | null)[]).map((p) => (
              <button
                key={p ?? 'indifferente'}
                onClick={() => setPreferenza(p)}
                className={[
                  'flex-1 rounded-lg border px-2 py-2 text-xs font-medium',
                  preferenza === p
                    ? 'border-accent/60 bg-accent/15 text-accent'
                    : 'border-border bg-surface-2 text-slate-400',
                ].join(' ')}
              >
                {p === null ? 'Indifferente' : p === 'quantita' ? '📦 Quantità' : '💎 Qualità'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <button
            onClick={() => setAccettaCrediti((v) => !v)}
            className={[
              'w-full rounded-lg border px-3 py-2 text-sm font-medium',
              accettaCrediti
                ? 'border-amber-500/50 bg-amber-500/15 text-amber-200'
                : 'border-border bg-surface-2 text-slate-400',
            ].join(' ')}
          >
            💰 {accettaCrediti ? 'Accetto crediti' : 'Non accetto crediti'}
          </button>
          {accettaCrediti && (
            <div className="mt-2">
              <p className="mb-1.5 text-xs text-slate-400">Minimo richiesto (0 = non specificato)</p>
              <QtyInput value={creditiMin} onChange={setCreditiMin} min={0} size="md" />
            </div>
          )}
        </div>

        <div>
          <p className="text-sm font-semibold text-white">Nota</p>
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            maxLength={280}
            rows={3}
            placeholder="Es. cerco un titolare di una big, niente scommesse"
            className="mt-1.5 w-full resize-none rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-white outline-none focus:border-accent"
          />
          <p className="mt-1 text-right text-[10px] text-slate-500">{nota.length}/280</p>
        </div>
      </div>

      <div className="flex gap-2 border-t border-border p-3">
        <button
          onClick={onClose}
          className="flex-1 rounded-xl border border-border bg-surface-2 py-2.5 text-sm font-medium text-slate-200 active:scale-[0.98]"
        >
          Annulla
        </button>
        <button
          onClick={onSubmit}
          disabled={salva.isPending}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent-strong py-2.5 text-sm font-semibold text-white active:scale-[0.98] disabled:opacity-50"
        >
          {salva.isPending && <Spinner className="h-4 w-4" />}
          {annuncio ? 'Salva' : 'Pubblica'}
        </button>
      </div>
    </ModalShell>
  )
}
