import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import * as XLSX from 'xlsx'
import { useAuctions, useCredits, useManagers, usePlayers, type Auction, type Manager, type Player } from '../lib/queries'
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
import { isActive, MANTRA_ROLES, parseRoles } from '../lib/format'
import {
  buildGiornateScores,
  useAdminSetOverride,
  useAdminSetPunteggio,
  useAdminSetRisultato,
  useAdminToggleGiornata,
  useGiornate,
  useOverrides,
  usePartite,
  usePronostici,
  usePunteggiGiornata,
  type Partita,
  type Pronostico,
} from '../lib/leagueQueries'
import { calculateMatchResult, resolveTournament, type TorneoOverrideInput } from '../lib/tornei'
import { initialMatches } from '../lib/torneoData'
import {
  computePodioClassifica,
  useAdminClosePodioRound,
  useAdminPodioVotes,
  useAdminStartPodioRound,
  usePodioRounds,
} from '../lib/podio'
import {
  useAdminAddAlboOro,
  useAdminAddStatisticaMercato,
  useAdminAddStoricoPartite,
  useAdminDeleteAlboOro,
  useAdminDeleteStatisticaMercato,
  useAdminDeleteStoricoPartita,
  useAdminDeleteStoricoStagione,
  useAdminUpdateStatisticaMercato,
  useAlboOro,
  useStatisticheMercato,
  useStoricoPartite,
} from '../lib/statisticheQueries'
import {
  useAdminDeleteScambio,
  useAdminEseguiScambio,
  useScambi,
  useScambioGiocatori,
  type ScambioGiocatore,
} from '../lib/scambi'

const inputCls =
  'w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-white outline-none focus:border-accent'

type Tab = 'managers' | 'players' | 'auctions' | 'giornate' | 'podio' | 'scambi' | 'statistiche'

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('managers')
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-white">Amministrazione</h1>
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-surface p-1 text-sm">
        <TabBtn active={tab === 'managers'} onClick={() => setTab('managers')}>
          Squadre
        </TabBtn>
        <TabBtn active={tab === 'players'} onClick={() => setTab('players')}>
          Giocatori
        </TabBtn>
        <TabBtn active={tab === 'auctions'} onClick={() => setTab('auctions')}>
          Aste
        </TabBtn>
        <TabBtn active={tab === 'giornate'} onClick={() => setTab('giornate')}>
          Giornate
        </TabBtn>
        <TabBtn active={tab === 'podio'} onClick={() => setTab('podio')}>
          Podio
        </TabBtn>
        <TabBtn active={tab === 'scambi'} onClick={() => setTab('scambi')}>
          Scambi
        </TabBtn>
        <TabBtn active={tab === 'statistiche'} onClick={() => setTab('statistiche')}>
          Statistiche
        </TabBtn>
      </div>
      {tab === 'managers' && <ManagersTab />}
      {tab === 'players' && <PlayersTab />}
      {tab === 'auctions' && <AuctionsTab />}
      {tab === 'giornate' && <GiornateTab />}
      {tab === 'podio' && <PodioTab />}
      {tab === 'scambi' && <ScambiTab />}
      {tab === 'statistiche' && <StatisticheTab />}
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

// Divide una riga CSV rispettando i campi tra virgolette (es. `"Cognome, Nome"`).
function splitCsvLine(line: string): string[] {
  const cells: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cur += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      cells.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  cells.push(cur)
  return cells
}

function parsePlayers(text: string): NewPlayer[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length === 0) return []

  // File incollati da Excel/Sheets usano il tab come separatore; i CSV veri usano la virgola.
  const useTab = lines[0].includes('\t')
  const rows = lines.map((line) => (useTab ? line.split('\t') : splitCsvLine(line)).map((c) => c.trim()))

  // Salta un'eventuale riga di intestazione (es. "Nome,Squadra,Ruoli").
  const firstCell = rows[0][0]?.toLowerCase()
  const dataRows = firstCell === 'nome' || firstCell === 'name' ? rows.slice(1) : rows

  return dataRows
    .map((parts) => {
      // I ruoli (3a colonna) possono essere multipli es. "Dd/Ds" o "M;C".
      const name = parts[0]
      const team = parts[1] || null
      const roles = parts[2] ? parseRoles(parts[2]) : []
      return { name, real_team: team, roles }
    })
    .filter((p) => p.name)
}

// Legge un file .xlsx (es. il listone svincolati Mantra) riconoscendo le colonne
// da intestazione: Nome, Sq., R.MANTRA, e (se presente) "Fuori lista" per escludere
// i giocatori non tesserabili quest'anno.
async function parseXlsxPlayers(file: File): Promise<NewPlayer[]> {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  if (!sheet) return []
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
  if (rows.length === 0) return []

  const header = rows[0].map((h) => String(h ?? '').trim().toLowerCase())
  const idxName = header.findIndex((h) => h === 'nome' || h === 'name')
  const idxTeam = header.findIndex((h) => h === 'sq.' || h === 'squadra' || h === 'team')
  // "R.MANTRA" ha priorità sulla generica "R." (ruolo classico), altrimenti finirebbe
  // per matchare quest'ultima essendo prima in colonna.
  const idxRoles =
    header.findIndex((h) => h.includes('mantra')) !== -1
      ? header.findIndex((h) => h.includes('mantra'))
      : header.findIndex((h) => h === 'r.' || h === 'ruolo' || h === 'ruoli')
  const idxOut = header.findIndex((h) => h.includes('fuori lista'))
  if (idxName === -1) return []

  const out: NewPlayer[] = []
  for (const row of rows.slice(1)) {
    if (idxOut !== -1 && String(row[idxOut] ?? '').trim() !== '') continue // esclude i "fuori lista"
    const name = String(row[idxName] ?? '').trim()
    if (!name) continue
    const team = idxTeam !== -1 ? String(row[idxTeam] ?? '').trim() || null : null
    const roles = idxRoles !== -1 ? parseRoles(String(row[idxRoles] ?? '')) : []
    out.push({ name, real_team: team, roles })
  }
  return out
}

function PlayersTab() {
  const { data: players, isLoading } = usePlayers()
  const qc = useQueryClient()
  const toast = useToast()
  const confirm = useConfirm()
  const [text, setText] = useState('')
  const [xlsxRows, setXlsxRows] = useState<NewPlayer[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const parsed = useMemo(() => xlsxRows ?? parsePlayers(text), [xlsxRows, text])

  function invalidatePlayers() {
    qc.invalidateQueries({ queryKey: ['players'] })
  }

  async function onFileSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // permette di ricaricare lo stesso file una seconda volta
    if (!file) return
    const isExcel = /\.xlsx?$/i.test(file.name)
    if (isExcel) {
      try {
        const rows = await parseXlsxPlayers(file)
        if (rows.length === 0) {
          toast.error('Nessun giocatore riconosciuto: colonne attese "Nome", "Sq.", "R.MANTRA"')
          return
        }
        setXlsxRows(rows)
        setText('')
        setFileName(file.name)
      } catch {
        toast.error('Impossibile leggere il file Excel')
      }
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setXlsxRows(null)
      setText(String(reader.result ?? ''))
      setFileName(file.name)
    }
    reader.onerror = () => toast.error('Impossibile leggere il file')
    reader.readAsText(file)
  }

  async function doImport() {
    if (parsed.length === 0) return
    setLoading(true)
    try {
      const n = await importPlayers(parsed)
      toast.success(`${n} giocatori importati`)
      setText('')
      setXlsxRows(null)
      setFileName(null)
      invalidatePlayers()
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
          Carica il listone Excel degli svincolati (colonne "Nome", "Sq.", "R.MANTRA"; i giocatori
          "Fuori lista" vengono esclusi automaticamente), oppure incolla/carica un CSV con un
          giocatore per riga: <code className="text-slate-300">Nome, Squadra, Ruoli</code> (ruoli
          Mantra, anche multipli es. <code className="text-slate-300">Dd/Ds</code> o{' '}
          <code className="text-slate-300">M;C</code>). Squadra e ruoli facoltativi.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={onFileSelected}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface-2 py-2.5 text-sm font-semibold text-slate-200"
        >
          📄 {fileName ? `File: ${fileName}` : 'Carica file Excel o CSV'}
        </button>

        <textarea
          value={text}
          onChange={(e) => {
            setXlsxRows(null)
            setText(e.target.value)
            setFileName(null)
          }}
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

      <AddSinglePlayerForm onAdded={invalidatePlayers} />

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

function AddSinglePlayerForm({ onAdded }: { onAdded: () => void }) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [team, setTeam] = useState('')
  const [roles, setRoles] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  function toggleRole(r: string) {
    setRoles((rs) => (rs.includes(r) ? rs.filter((x) => x !== r) : [...rs, r]))
  }

  function reset() {
    setName('')
    setTeam('')
    setRoles([])
  }

  async function submit() {
    if (!name.trim()) return
    setSaving(true)
    try {
      await importPlayers([{ name: name.trim(), real_team: team.trim() || null, roles }])
      toast.success(`«${name.trim()}» aggiunto`)
      reset()
      onAdded()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-sm font-semibold text-slate-200"
      >
        <span>+ Aggiungi un giocatore</span>
        <span className="text-slate-500">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          <input
            className={inputCls}
            placeholder="Nome giocatore"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className={inputCls}
            placeholder="Squadra reale (facoltativo)"
            value={team}
            onChange={(e) => setTeam(e.target.value)}
          />
          <div className="flex flex-wrap gap-1.5">
            {MANTRA_ROLES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => toggleRole(r)}
                className={[
                  'rounded-lg border px-2.5 py-1.5 text-xs font-semibold',
                  roles.includes(r)
                    ? 'border-accent/60 bg-accent/15 text-accent'
                    : 'border-border bg-surface-2 text-slate-300',
                ].join(' ')}
              >
                {r}
              </button>
            ))}
          </div>
          <button
            onClick={submit}
            disabled={saving || !name.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent-strong py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? <Spinner /> : 'Aggiungi giocatore'}
          </button>
        </div>
      )}
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

/* ---------------- Giornate: punteggi, risultati, chiusura, spareggi ---------------- */

function GiornateTab() {
  const { data: giornate, isLoading } = useGiornate()
  const { data: partite } = usePartite()
  const { data: punteggi } = usePunteggiGiornata()
  const { data: managers } = useManagers()
  const { data: pronostici } = usePronostici()
  const { data: overrides } = useOverrides()
  const toast = useToast()

  const setPunteggio = useAdminSetPunteggio()
  const setRisultato = useAdminSetRisultato()
  const toggleGiornata = useAdminToggleGiornata()
  const setOverride = useAdminSetOverride()

  const numeri = useMemo(() => (giornate ?? []).map((g) => g.numero), [giornate])
  const [selected, setSelected] = useState<number | null>(null)
  const current = selected ?? (numeri.length > 0 ? numeri[0] : null)
  const giornataInfo = giornate?.find((g) => g.numero === current)

  const squadre = useMemo(
    () => (managers ?? []).filter((m) => !!m.team_name).sort((a, b) => (a.team_name || a.display_name).localeCompare(b.team_name || b.display_name)),
    [managers],
  )

  const partiteGiornata = useMemo(
    () => (partite ?? []).filter((p) => p.giornata === current).sort((a, b) => a.ordine - b.ordine),
    [partite, current],
  )

  // Stato locale editabile: punteggi fanta per manager.
  const [scores, setScores] = useState<Record<string, string>>({})

  // Reinizializza lo stato locale al cambio giornata / dati.
  useEffect(() => {
    if (current == null) return
    const s: Record<string, string> = {}
    for (const p of punteggi ?? []) {
      if (p.giornata === current) s[p.manager_id] = String(p.punteggio)
    }
    setScores(s)
  }, [current, punteggi])

  const pronosticiCount = useMemo(() => {
    if (!pronostici) return 0
    const set = new Set<string>()
    for (const p of pronostici) if (p.giornata === current) set.add(p.manager_id)
    return set.size
  }, [pronostici, current])

  // Spareggi bracket per la giornata corrente (pareggi perfetti senza vincitore).
  const spareggi = useMemo(() => {
    if (!managers || !punteggi) return []
    const scoresMap = buildGiornateScores(punteggi, managers)
    const ovr: Record<string, TorneoOverrideInput> = {}
    for (const o of overrides ?? [])
      ovr[o.match_id] = { winner: o.winner as 'A' | 'B', golA: o.gol_a, golB: o.gol_b }
    const resolved = resolveTournament(initialMatches, scoresMap, ovr)
    return resolved.filter((m) => m.day === current && m.draw)
  }, [managers, punteggi, overrides, current])

  if (isLoading || !managers) return <PageLoader />
  if (current == null) return <p className="py-8 text-center text-sm text-slate-500">Nessuna giornata.</p>

  // Unica fonte di verità: il punteggio fanta totale di ogni squadra. Da qui si
  // ricava tutto il resto — Battle Royale e bracket lo leggono direttamente da
  // punteggi_giornata (vedi Tornei.tsx), qui in più calcoliamo e salviamo anche
  // i gol delle partite del campionato (per la correzione dei pronostici),
  // con le stesse regole a soglie di calculateMatchResult.
  async function salvaPunteggi() {
    if (current == null) return
    const parsed: Record<string, number> = {}
    const ops: Promise<unknown>[] = []
    for (const m of squadre) {
      const raw = (scores[m.id] ?? '').replace(',', '.').trim()
      const val = raw === '' ? null : Number(raw)
      if (raw !== '' && !Number.isFinite(val)) continue
      ops.push(setPunteggio.mutateAsync({ giornata: current, manager_id: m.id, punteggio: val }))
      if (val != null) parsed[m.id] = val
    }
    for (const p of partiteGiornata) {
      const sc = p.casa_manager != null ? parsed[p.casa_manager] : undefined
      const st = p.trasferta_manager != null ? parsed[p.trasferta_manager] : undefined
      if (sc == null || st == null) continue
      const r = calculateMatchResult(sc, st)
      ops.push(setRisultato.mutateAsync({ partita_id: p.id, gol_casa: r.golA, gol_trasferta: r.golB }))
    }
    try {
      await Promise.all(ops)
      toast.success('Punteggi e risultati campionato salvati')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  async function toggleChiusura() {
    if (current == null) return
    try {
      await toggleGiornata.mutateAsync({ numero: current, chiusa: !giornataInfo?.pronostici_chiusi })
      toast.success(giornataInfo?.pronostici_chiusi ? 'Pronostici riaperti' : 'Pronostici chiusi')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  return (
    <div className="space-y-3">
      <GiornataPickerAdmin numeri={numeri} current={current} onChange={setSelected} />

      {/* Chiusura pronostici */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-surface p-3">
        <div>
          <p className="text-sm font-medium text-white">
            Pronostici {giornataInfo?.pronostici_chiusi ? 'chiusi' : 'aperti'}
          </p>
          <p className="text-xs text-slate-400">{pronosticiCount} squadre hanno pronosticato</p>
        </div>
        <button
          onClick={toggleChiusura}
          className={[
            'rounded-lg border px-3 py-1.5 text-xs font-semibold',
            giornataInfo?.pronostici_chiusi
              ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200'
              : 'border-amber-500/50 bg-amber-500/10 text-amber-200',
          ].join(' ')}
        >
          {giornataInfo?.pronostici_chiusi ? 'Riapri' : 'Chiudi'}
        </button>
      </div>

      {/* Chi ha pronosticato cosa */}
      <PronosticiList
        squadre={squadre}
        partite={partiteGiornata}
        pronostici={(pronostici ?? []).filter((p) => p.giornata === current)}
      />

      {/* Punteggi fanta */}
      <div className="rounded-xl border border-border bg-surface p-3">
        <h3 className="text-sm font-semibold text-slate-200">Punteggi fanta di giornata</h3>
        <p className="mt-1 text-xs text-slate-400">
          Unico input della giornata: da qui si calcolano Battle Royale, bracket e i risultati del
          campionato (sotto) per la correzione dei pronostici.
        </p>
        <div className="mt-2 space-y-1">
          {squadre.map((m) => (
            <div key={m.id} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-sm text-white">{m.team_name || m.display_name}</span>
              <input
                type="text"
                inputMode="decimal"
                value={scores[m.id] ?? ''}
                onChange={(e) => setScores((s) => ({ ...s, [m.id]: e.target.value.replace(/[^0-9.,]/g, '') }))}
                onFocus={(e) => e.currentTarget.select()}
                placeholder="—"
                className="h-9 w-20 rounded-lg border border-border bg-surface-2 text-center text-sm font-semibold text-white outline-none focus:border-accent"
              />
            </div>
          ))}
        </div>
        <button
          onClick={salvaPunteggi}
          disabled={setPunteggio.isPending || setRisultato.isPending}
          className="mt-3 w-full rounded-lg bg-accent-strong py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Salva punteggi
        </button>
      </div>

      {/* Risultati partite (pronostici): sola lettura, calcolati dai punteggi sopra */}
      <div className="rounded-xl border border-border bg-surface p-3">
        <h3 className="text-sm font-semibold text-slate-200">Risultati partite (pronostici)</h3>
        <p className="mt-1 text-xs text-slate-400">Calcolati automaticamente dai punteggi fanta.</p>
        <div className="mt-2 space-y-1.5">
          {partiteGiornata.map((p) => (
            <div key={p.id} className="flex items-center gap-1.5 text-sm">
              <span className="min-w-0 flex-1 truncate text-right text-slate-200">{p.casa}</span>
              <span className="min-w-[3.5rem] rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-center font-semibold text-white">
                {p.gol_casa ?? '—'} - {p.gol_trasferta ?? '—'}
              </span>
              <span className="min-w-0 flex-1 truncate text-slate-200">{p.trasferta}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Spareggi bracket */}
      {spareggi.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-surface p-3">
          <h3 className="text-sm font-semibold text-amber-200">Spareggi da assegnare</h3>
          <p className="mt-1 text-xs text-slate-400">Punteggio fanta identico: scegli chi passa il turno.</p>
          <div className="mt-2 space-y-2">
            {spareggi.map((m) => {
              const currentWinner = (overrides ?? []).find((o) => o.match_id === m.id)?.winner
              return (
                <div key={m.id} className="rounded-lg border border-border bg-surface-2 p-2">
                  <p className="mb-1.5 text-xs text-slate-300">
                    {m.label ? `${m.label}: ` : ''}
                    {m.teamA} vs {m.teamB}
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(['A', 'B'] as const).map((side) => (
                      <button
                        key={side}
                        onClick={() =>
                          setOverride.mutate({ match_id: m.id, winner: currentWinner === side ? null : side })
                        }
                        className={[
                          'rounded-lg border py-1.5 text-xs font-semibold',
                          currentWinner === side
                            ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-200'
                            : 'border-border bg-surface text-slate-300',
                        ].join(' ')}
                      >
                        {side === 'A' ? m.teamA : m.teamB}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function GiornataPickerAdmin({
  numeri,
  current,
  onChange,
}: {
  numeri: number[]
  current: number
  onChange: (n: number) => void
}) {
  const idx = numeri.indexOf(current)
  const prev = idx > 0 ? numeri[idx - 1] : null
  const next = idx >= 0 && idx < numeri.length - 1 ? numeri[idx + 1] : null
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-surface px-2 py-1.5">
      <button
        onClick={() => prev != null && onChange(prev)}
        disabled={prev == null}
        className="h-9 w-9 rounded-lg text-lg text-slate-300 disabled:opacity-30"
      >
        ‹
      </button>
      <span className="text-sm font-semibold text-white">Giornata {current}</span>
      <button
        onClick={() => next != null && onChange(next)}
        disabled={next == null}
        className="h-9 w-9 rounded-lg text-lg text-slate-300 disabled:opacity-30"
      >
        ›
      </button>
    </div>
  )
}

function PronosticiList({
  squadre,
  partite,
  pronostici,
}: {
  squadre: Manager[]
  partite: Partita[]
  pronostici: Pronostico[]
}) {
  const [openId, setOpenId] = useState<string | null>(null)

  const byManager = useMemo(() => {
    const map = new Map<string, Pronostico[]>()
    for (const p of pronostici) {
      const arr = map.get(p.manager_id) ?? []
      arr.push(p)
      map.set(p.manager_id, arr)
    }
    return map
  }, [pronostici])

  const partiteMap = useMemo(() => new Map(partite.map((p) => [p.id, p])), [partite])

  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <h3 className="text-sm font-semibold text-slate-200">Chi ha pronosticato</h3>
      {partite.length === 0 ? (
        <p className="mt-2 text-xs text-slate-500">Nessuna partita in questa giornata.</p>
      ) : (
        <div className="mt-2 space-y-1.5">
          {squadre.map((m) => {
            const mine = byManager.get(m.id!) ?? []
            const done = mine.length
            const total = partite.length
            const open = openId === m.id
            return (
              <div key={m.id!} className="overflow-hidden rounded-lg border border-border bg-surface-2">
                <button
                  onClick={() => setOpenId(open ? null : (m.id ?? null))}
                  className="flex w-full items-center justify-between px-2.5 py-2 text-left"
                >
                  <span className="text-sm text-white">{m.team_name || m.display_name}</span>
                  <span
                    className={[
                      'text-xs font-semibold',
                      done === 0 ? 'text-slate-500' : done === total ? 'text-emerald-300' : 'text-amber-300',
                    ].join(' ')}
                  >
                    {done}/{total}
                  </span>
                </button>
                {open && (
                  <div className="space-y-1 border-t border-border px-2.5 py-2">
                    {mine.length === 0 ? (
                      <p className="text-xs text-slate-500">Nessun pronostico.</p>
                    ) : (
                      mine
                        .slice()
                        .sort((a, b) => (partiteMap.get(a.partita_id)?.ordine ?? 0) - (partiteMap.get(b.partita_id)?.ordine ?? 0))
                        .map((p) => {
                          const partita = partiteMap.get(p.partita_id)
                          if (!partita) return null
                          return (
                            <p key={p.partita_id} className="text-xs text-slate-300">
                              {partita.casa} - {partita.trasferta}: <b className="text-white">{p.pronostico_1x2}</b>
                              {' · '}
                              {p.pronostico_ou}
                            </p>
                          )
                        })
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ---------------- Podio: votazione podio finale ---------------- */

function PodioTab() {
  const { data: rounds, isLoading } = usePodioRounds()
  const { data: managers } = useManagers()
  const toast = useToast()
  const confirm = useConfirm()
  const startRound = useAdminStartPodioRound()
  const closeRound = useAdminClosePodioRound()

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const current = rounds?.find((r) => r.id === selectedId) ?? rounds?.[0] ?? null

  const { data: votes } = useAdminPodioVotes(current?.id)

  const squadre = useMemo(
    () => (managers ?? []).filter((m) => !!m.team_name),
    [managers],
  )
  const nameOf = (id: string) => {
    const m = squadre.find((s) => s.id === id)
    return m ? m.team_name || m.display_name : '—'
  }

  const classifica = useMemo(
    () => (votes && managers ? computePodioClassifica(votes, managers) : []),
    [votes, managers],
  )

  async function onStart() {
    const openRound = rounds?.find((r) => r.status === 'open')
    if (openRound) {
      const ok = await confirm({
        title: 'Avviare una nuova votazione?',
        message: `La votazione ${openRound.numero} in corso verrà chiusa e non sarà più modificabile dagli utenti.`,
        confirmLabel: 'Avvia nuova',
      })
      if (!ok) return
    }
    try {
      await startRound.mutateAsync()
      toast.success('Votazione podio avviata')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  async function onClose(roundId: number) {
    const ok = await confirm({
      title: 'Chiudere la votazione?',
      message: 'Gli utenti non potranno più votare o modificare il voto per questo round.',
      confirmLabel: 'Chiudi',
    })
    if (!ok) return
    try {
      await closeRound.mutateAsync(roundId)
      toast.success('Votazione chiusa')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  if (isLoading || !managers) return <PageLoader />

  return (
    <div className="space-y-3">
      <button
        onClick={onStart}
        disabled={startRound.isPending}
        className="w-full rounded-xl bg-accent-strong py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        + Avvia nuova votazione podio
      </button>

      {(!rounds || rounds.length === 0) && (
        <p className="py-8 text-center text-sm text-slate-500">Nessuna votazione ancora avviata.</p>
      )}

      {rounds && rounds.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {rounds.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedId(r.id)}
              className={[
                'rounded-lg border px-3 py-1.5 text-xs font-medium',
                (current?.id ?? rounds[0].id) === r.id
                  ? 'border-accent/60 bg-accent/15 text-accent'
                  : 'border-border bg-surface text-slate-300',
              ].join(' ')}
            >
              Votazione {r.numero} · {r.status === 'open' ? 'aperta' : 'chiusa'}
            </button>
          ))}
        </div>
      )}

      {current && (
        <>
          {current.status === 'open' && (
            <button
              onClick={() => onClose(current.id)}
              className="w-full rounded-lg border border-amber-500/50 bg-amber-500/10 py-2 text-sm font-semibold text-amber-200"
            >
              Chiudi votazione {current.numero}
            </button>
          )}

          <div className="rounded-xl border border-border bg-surface p-3">
            <h3 className="text-sm font-semibold text-slate-200">Classifica podio · Votazione {current.numero}</h3>
            {classifica.every((r) => r.punti === 0) ? (
              <p className="mt-2 text-xs text-slate-500">Nessun voto ancora.</p>
            ) : (
              <div className="mt-2 overflow-hidden rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface-2 text-xs uppercase tracking-wide text-slate-400">
                      <th className="px-2 py-1.5 text-left font-medium">Squadra</th>
                      <th className="px-2 py-1.5 text-center font-medium">1°</th>
                      <th className="px-2 py-1.5 text-center font-medium">2°</th>
                      <th className="px-2 py-1.5 text-center font-medium">3°</th>
                      <th className="px-2 py-1.5 text-right font-medium">Punti</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classifica.map((r) => (
                      <tr key={r.managerId} className="border-t border-border bg-surface">
                        <td className="px-2 py-1.5 font-medium text-white">{r.nome}</td>
                        <td className="px-2 py-1.5 text-center text-slate-300">{r.c1}</td>
                        <td className="px-2 py-1.5 text-center text-slate-300">{r.c2}</td>
                        <td className="px-2 py-1.5 text-center text-slate-300">{r.c3}</td>
                        <td className="px-2 py-1.5 text-right font-bold text-accent">{r.punti}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-surface p-3">
            <h3 className="text-sm font-semibold text-slate-200">Chi ha votato cosa</h3>
            {!votes || votes.length === 0 ? (
              <p className="mt-2 text-xs text-slate-500">Nessun voto ancora.</p>
            ) : (
              <div className="mt-2 space-y-1.5">
                {votes.map((v) => (
                  <p key={v.manager_id} className="text-sm text-slate-200">
                    <span className="font-semibold text-white">{nameOf(v.manager_id)}</span>: 1°{' '}
                    {nameOf(v.pos1)}, 2° {nameOf(v.pos2)}, 3° {nameOf(v.pos3)}
                  </p>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

/* ---------------- Scambi: mercato tra rose ---------------- */

function ScambiTab() {
  const { data: managers, isLoading: loadingManagers } = useManagers()
  const { data: players, isLoading: loadingPlayers } = usePlayers()
  const { data: credits } = useCredits()
  const { data: scambi, isLoading: loadingScambi } = useScambi()
  const { data: scambioGiocatori } = useScambioGiocatori()
  const eseguiScambio = useAdminEseguiScambio()
  const deleteScambio = useAdminDeleteScambio()
  const toast = useToast()
  const confirm = useConfirm()

  const squadre = useMemo(
    () =>
      (managers ?? [])
        .filter((m) => !!m.team_name)
        .sort((a, b) => (a.team_name || a.display_name).localeCompare(b.team_name || b.display_name)),
    [managers],
  )

  const [managerAId, setManagerAId] = useState('')
  const [managerBId, setManagerBId] = useState('')
  const [selectedA, setSelectedA] = useState<Set<number>>(new Set())
  const [selectedB, setSelectedB] = useState<Set<number>>(new Set())
  const [creditiA, setCreditiA] = useState('0')
  const [creditiB, setCreditiB] = useState('0')
  const [note, setNote] = useState('')

  const managerA = squadre.find((m) => m.id === managerAId)
  const managerB = squadre.find((m) => m.id === managerBId)
  const nomeA = managerA?.team_name || managerA?.display_name || ''
  const nomeB = managerB?.team_name || managerB?.display_name || ''
  const creditsA = credits?.find((c) => c.id === managerAId)
  const creditsB = credits?.find((c) => c.id === managerBId)

  const rosterA = useMemo(
    () =>
      (players ?? [])
        .filter((p) => p.assigned_to === managerAId && p.status === 'assigned')
        .sort((a, b) => a.name.localeCompare(b.name)),
    [players, managerAId],
  )
  const rosterB = useMemo(
    () =>
      (players ?? [])
        .filter((p) => p.assigned_to === managerBId && p.status === 'assigned')
        .sort((a, b) => a.name.localeCompare(b.name)),
    [players, managerBId],
  )

  function toggle(set: Set<number>, setSet: (s: Set<number>) => void, id: number) {
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSet(next)
  }

  function resetForm() {
    setSelectedA(new Set())
    setSelectedB(new Set())
    setCreditiA('0')
    setCreditiB('0')
    setNote('')
  }

  const numCreditiA = Number(creditiA) || 0
  const numCreditiB = Number(creditiB) || 0
  const canSubmit =
    !!managerAId && !!managerBId && managerAId !== managerBId &&
    (selectedA.size > 0 || selectedB.size > 0 || numCreditiA > 0 || numCreditiB > 0)

  async function eseguiScambioClick() {
    if (!managerA || !managerB) return
    const nomiA = rosterA.filter((p) => selectedA.has(p.id)).map((p) => p.name)
    const nomiB = rosterB.filter((p) => selectedB.has(p.id)).map((p) => p.name)
    const righe: string[] = []
    if (nomiA.length) righe.push(`${nomeA} cede: ${nomiA.join(', ')}`)
    if (nomiB.length) righe.push(`${nomeB} cede: ${nomiB.join(', ')}`)
    if (numCreditiA > 0) righe.push(`${nomeA} cede anche ${numCreditiA} crediti`)
    if (numCreditiB > 0) righe.push(`${nomeB} cede anche ${numCreditiB} crediti`)

    const ok = await confirm({
      title: 'Confermare lo scambio?',
      message: righe.join('\n'),
      confirmLabel: 'Esegui scambio',
    })
    if (!ok) return
    try {
      await eseguiScambio.mutateAsync({
        managerA: managerAId,
        managerB: managerBId,
        playersA: Array.from(selectedA),
        playersB: Array.from(selectedB),
        creditiA: numCreditiA,
        creditiB: numCreditiB,
        note: note.trim() || null,
      })
      toast.success('Scambio eseguito')
      resetForm()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  async function rimuoviScambio(id: number, label: string) {
    const ok = await confirm({
      title: 'Eliminare la registrazione dello scambio?',
      message: `${label}\n\nViene rimossa solo la voce dallo storico: giocatori e crediti già spostati non vengono ripristinati automaticamente.`,
      danger: true,
      confirmLabel: 'Elimina',
    })
    if (!ok) return
    try {
      await deleteScambio.mutateAsync(id)
      toast.success('Registrazione eliminata')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  const giocatoriPerScambio = useMemo(() => {
    const map = new Map<number, ScambioGiocatore[]>()
    for (const g of scambioGiocatori ?? []) {
      const arr = map.get(g.scambio_id) ?? []
      arr.push(g)
      map.set(g.scambio_id, arr)
    }
    return map
  }, [scambioGiocatori])

  if (loadingManagers || loadingPlayers || loadingScambi) return <PageLoader />

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-surface p-3">
        <h2 className="text-sm font-semibold text-slate-200">Nuovo scambio</h2>
        <p className="mt-1 text-xs text-slate-400">
          Seleziona due squadre, i giocatori che si scambiano ed eventuali crediti a saldo.
        </p>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <select
            className={inputCls}
            value={managerAId}
            onChange={(e) => {
              setManagerAId(e.target.value)
              setSelectedA(new Set())
            }}
          >
            <option value="">Squadra A…</option>
            {squadre
              .filter((m) => m.id !== managerBId)
              .map((m) => (
                <option key={m.id} value={m.id!}>
                  {m.team_name || m.display_name}
                </option>
              ))}
          </select>
          <select
            className={inputCls}
            value={managerBId}
            onChange={(e) => {
              setManagerBId(e.target.value)
              setSelectedB(new Set())
            }}
          >
            <option value="">Squadra B…</option>
            {squadre
              .filter((m) => m.id !== managerAId)
              .map((m) => (
                <option key={m.id} value={m.id!}>
                  {m.team_name || m.display_name}
                </option>
              ))}
          </select>
        </div>

        {managerAId && managerBId && (
          <>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <RosterPicker title={`${nomeA} cede`} players={rosterA} selected={selectedA} onToggle={(id) => toggle(selectedA, setSelectedA, id)} />
              <RosterPicker title={`${nomeB} cede`} players={rosterB} selected={selectedB} onToggle={(id) => toggle(selectedB, setSelectedB, id)} />
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-400">
                  Crediti da {nomeA} ({creditsA?.credits_total ?? 0} tot.)
                </label>
                <input
                  className={`${inputCls} mt-1`}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={creditiA}
                  onFocus={(e) => e.currentTarget.select()}
                  onChange={(e) => setCreditiA(e.target.value.replace(/\D/g, ''))}
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">
                  Crediti da {nomeB} ({creditsB?.credits_total ?? 0} tot.)
                </label>
                <input
                  className={`${inputCls} mt-1`}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={creditiB}
                  onFocus={(e) => e.currentTarget.select()}
                  onChange={(e) => setCreditiB(e.target.value.replace(/\D/g, ''))}
                />
              </div>
            </div>

            <input
              className={`${inputCls} mt-2`}
              placeholder="Nota (facoltativa)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />

            <button
              onClick={eseguiScambioClick}
              disabled={!canSubmit || eseguiScambio.isPending}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-accent-strong py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {eseguiScambio.isPending ? <Spinner /> : 'Esegui scambio'}
            </button>
          </>
        )}
      </div>

      <div className="rounded-xl border border-border bg-surface p-3">
        <h3 className="text-sm font-semibold text-slate-200">Storico scambi</h3>
        {!scambi || scambi.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">Nessuno scambio registrato.</p>
        ) : (
          <div className="mt-2 space-y-2">
            {scambi.map((s) => {
              const giocatori = giocatoriPerScambio.get(s.id) ?? []
              const daA = giocatori.filter((g) => g.da === s.squadra_a)
              const daB = giocatori.filter((g) => g.da === s.squadra_b)
              const label = `${s.squadra_a} ↔ ${s.squadra_b}`
              return (
                <div key={s.id} className="rounded-lg border border-border bg-surface-2 p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white">{label}</p>
                      <p className="text-xs text-slate-500">{new Date(s.data).toLocaleString('it-IT')}</p>
                    </div>
                    <button onClick={() => rimuoviScambio(s.id, label)} className="shrink-0 text-xs text-rose-300">
                      Elimina
                    </button>
                  </div>
                  <div className="mt-1.5 space-y-0.5 text-xs text-slate-300">
                    {daA.length > 0 && (
                      <p>
                        {s.squadra_a} → {s.squadra_b}: {daA.map((g) => g.giocatore).join(', ')}
                      </p>
                    )}
                    {daB.length > 0 && (
                      <p>
                        {s.squadra_b} → {s.squadra_a}: {daB.map((g) => g.giocatore).join(', ')}
                      </p>
                    )}
                    {s.crediti_a > 0 && (
                      <p>
                        {s.squadra_a} → {s.squadra_b}: {s.crediti_a} crediti
                      </p>
                    )}
                    {s.crediti_b > 0 && (
                      <p>
                        {s.squadra_b} → {s.squadra_a}: {s.crediti_b} crediti
                      </p>
                    )}
                    {s.note && <p className="text-slate-500">Nota: {s.note}</p>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function RosterPicker({
  title,
  players,
  selected,
  onToggle,
}: {
  title: string
  players: Player[]
  selected: Set<number>
  onToggle: (id: number) => void
}) {
  return (
    <div className="rounded-lg border border-border bg-surface-2 p-2">
      <p className="text-xs font-semibold text-slate-300">{title}</p>
      <div className="mt-1.5 max-h-56 space-y-1 overflow-y-auto">
        {players.length === 0 ? (
          <p className="text-xs text-slate-500">Rosa vuota.</p>
        ) : (
          players.map((p) => (
            <label key={p.id} className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-xs text-slate-200">
              <input
                type="checkbox"
                checked={selected.has(p.id)}
                onChange={() => onToggle(p.id)}
                className="h-3.5 w-3.5 shrink-0 accent-emerald-500"
              />
              <RoleBadge roles={p.roles} />
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
            </label>
          ))
        )}
      </div>
    </div>
  )
}

/* ---------------- Statistiche: storico partite, albo d'oro, mercato ---------------- */

function StatisticheTab() {
  return (
    <div className="space-y-4">
      <StoricoPartiteSection />
      <AlboOroSection />
      <MercatoSection />
    </div>
  )
}

function parseStoricoPartite(
  text: string,
): { giornata: number; casa: string; trasferta: string; gol_casa: number; gol_trasferta: number; punti_casa: number | null; punti_trasferta: number | null }[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  const useTab = lines[0]?.includes('\t')
  const rows = lines.map((line) => (useTab ? line.split('\t') : splitCsvLine(line)).map((c) => c.trim()))
  const firstCell = rows[0]?.[0]?.toLowerCase()
  const dataRows = firstCell === 'giornata' ? rows.slice(1) : rows

  return dataRows
    .map((parts) => {
      const puntiCasa = parseFloat(parts[5])
      const puntiTrasferta = parseFloat(parts[6])
      return {
        giornata: parseInt(parts[0], 10),
        casa: parts[1],
        trasferta: parts[2],
        gol_casa: parseInt(parts[3], 10),
        gol_trasferta: parseInt(parts[4], 10),
        punti_casa: Number.isFinite(puntiCasa) ? puntiCasa : null,
        punti_trasferta: Number.isFinite(puntiTrasferta) ? puntiTrasferta : null,
      }
    })
    .filter(
      (r) =>
        Number.isFinite(r.giornata) && r.casa && r.trasferta && Number.isFinite(r.gol_casa) && Number.isFinite(r.gol_trasferta),
    )
}

function StoricoPartiteSection() {
  const { data: storico } = useStoricoPartite()
  const addRows = useAdminAddStoricoPartite()
  const deleteRow = useAdminDeleteStoricoPartita()
  const deleteStagione = useAdminDeleteStoricoStagione()
  const toast = useToast()
  const confirm = useConfirm()

  const [stagione, setStagione] = useState('')
  const [testo, setTesto] = useState('')
  const [openStagione, setOpenStagione] = useState<string | null>(null)

  const stagioni = useMemo(() => {
    const map = new Map<string, typeof storico>()
    for (const r of storico ?? []) {
      if (!map.has(r.stagione)) map.set(r.stagione, [])
      map.get(r.stagione)!.push(r)
    }
    return Array.from(map.entries())
  }, [storico])

  async function importa() {
    const parsed = parseStoricoPartite(testo)
    if (!stagione.trim() || parsed.length === 0) {
      toast.error('Inserisci stagione e almeno una riga valida')
      return
    }
    try {
      await addRows.mutateAsync(parsed.map((r) => ({ ...r, stagione: stagione.trim() })))
      toast.success(`${parsed.length} partite importate`)
      setTesto('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  async function rimuoviStagione(s: string) {
    const ok = await confirm({
      title: `Eliminare "${s}"?`,
      message: 'Tutte le partite di questa stagione storica verranno rimosse.',
      danger: true,
    })
    if (!ok) return
    try {
      await deleteStagione.mutateAsync(s)
      toast.success('Stagione eliminata')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <h3 className="text-sm font-semibold text-slate-200">Storico partite (stagioni passate)</h3>
      <p className="mt-1 text-xs text-slate-400">
        Calendario di una stagione già conclusa: alimenta i record di "Statistiche campionato" e gli scontri
        diretti. Una riga per partita: giornata, casa, trasferta, gol casa, gol trasferta, punti fanta casa
        (opz.), punti fanta trasferta (opz.) — CSV o incolla da Excel.
      </p>
      <input
        value={stagione}
        onChange={(e) => setStagione(e.target.value)}
        placeholder='Nome stagione (es. "2024/25")'
        className={`${inputCls} mt-2`}
      />
      <textarea
        value={testo}
        onChange={(e) => setTesto(e.target.value)}
        placeholder={'1,One Pisa,QARABAGGIO,2,1,73.5,68\n1,Sesko e Sambia,Napolethanos,0,0,65,70.5'}
        rows={5}
        className={`${inputCls} mt-2 font-mono text-xs`}
      />
      <button
        onClick={importa}
        disabled={addRows.isPending}
        className="mt-2 w-full rounded-lg bg-accent-strong py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        Importa
      </button>

      {stagioni.length > 0 && (
        <div className="mt-3 space-y-2">
          {stagioni.map(([s, rows]) => (
            <div key={s} className="rounded-lg border border-border bg-surface-2">
              <div className="flex items-center justify-between gap-2 px-3 py-2">
                <button
                  onClick={() => setOpenStagione((o) => (o === s ? null : s))}
                  className="min-w-0 flex-1 truncate text-left text-sm font-medium text-white"
                >
                  {s} · {rows?.length ?? 0} partite
                </button>
                <button
                  onClick={() => rimuoviStagione(s)}
                  className="shrink-0 rounded-lg border border-rose-500/40 px-2 py-1 text-xs text-rose-300"
                >
                  Elimina tutto
                </button>
              </div>
              {openStagione === s && (
                <div className="space-y-1 border-t border-border px-3 py-2">
                  {(rows ?? []).map((r) => (
                    <div key={r.id} className="flex items-center justify-between text-xs text-slate-300">
                      <span>
                        G{r.giornata} · {r.casa} {r.gol_casa}-{r.gol_trasferta} {r.trasferta}
                      </span>
                      <button
                        onClick={() => deleteRow.mutate(r.id)}
                        className="shrink-0 text-slate-500 active:text-rose-300"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const COMPETIZIONI = [
  { value: 'campionato', label: 'Campionato' },
  { value: 'coppa', label: 'Coppa' },
  { value: 'battle_royale', label: 'Battle Royale' },
] as const

function AlboOroSection() {
  const { data: entries } = useAlboOro()
  const addEntry = useAdminAddAlboOro()
  const deleteEntry = useAdminDeleteAlboOro()
  const toast = useToast()

  const [stagione, setStagione] = useState('')
  const [competizione, setCompetizione] = useState<string>('campionato')
  const [squadra, setSquadra] = useState('')
  const [note, setNote] = useState('')

  async function aggiungi() {
    if (!stagione.trim() || !squadra.trim()) {
      toast.error('Stagione e squadra sono obbligatorie')
      return
    }
    try {
      await addEntry.mutateAsync({
        stagione: stagione.trim(),
        competizione,
        squadra: squadra.trim(),
        note: note.trim() || null,
      })
      toast.success('Trofeo aggiunto')
      setSquadra('')
      setNote('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <h3 className="text-sm font-semibold text-slate-200">Albo d'oro</h3>
      <p className="mt-1 text-xs text-slate-400">Un trofeo per squadra/stagione/competizione.</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <input
          value={stagione}
          onChange={(e) => setStagione(e.target.value)}
          placeholder='Stagione (es. "2024/25")'
          className={inputCls}
        />
        <select value={competizione} onChange={(e) => setCompetizione(e.target.value)} className={inputCls}>
          {COMPETIZIONI.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <input
          value={squadra}
          onChange={(e) => setSquadra(e.target.value)}
          placeholder="Squadra vincitrice"
          className={`${inputCls} col-span-2`}
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Nota (opzionale)"
          className={`${inputCls} col-span-2`}
        />
      </div>
      <button
        onClick={aggiungi}
        disabled={addEntry.isPending}
        className="mt-2 w-full rounded-lg bg-accent-strong py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        Aggiungi trofeo
      </button>

      {entries && entries.length > 0 && (
        <div className="mt-3 space-y-1">
          {entries.map((e) => (
            <div
              key={e.id}
              className="flex items-center justify-between rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-xs text-slate-300"
            >
              <span>
                {e.stagione} · {COMPETIZIONI.find((c) => c.value === e.competizione)?.label ?? e.competizione} ·{' '}
                <span className="font-semibold text-white">{e.squadra}</span>
                {e.note && <span className="text-slate-500"> ({e.note})</span>}
              </span>
              <button onClick={() => deleteEntry.mutate(e.id)} className="shrink-0 text-slate-500 active:text-rose-300">
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MercatoSection() {
  const { data: voci } = useStatisticheMercato()
  const addVoce = useAdminAddStatisticaMercato()
  const updateVoce = useAdminUpdateStatisticaMercato()
  const deleteVoce = useAdminDeleteStatisticaMercato()
  const toast = useToast()

  const [editingId, setEditingId] = useState<number | null>(null)
  const [titolo, setTitolo] = useState('')
  const [testo, setTesto] = useState('')
  const [data, setData] = useState('')

  function resetForm() {
    setEditingId(null)
    setTitolo('')
    setTesto('')
    setData('')
  }

  function edit(v: { id: number; titolo: string; testo: string; data: string | null }) {
    setEditingId(v.id)
    setTitolo(v.titolo)
    setTesto(v.testo)
    setData(v.data ?? '')
  }

  async function salva() {
    if (!titolo.trim() || !testo.trim()) {
      toast.error('Titolo e testo sono obbligatori')
      return
    }
    try {
      if (editingId != null) {
        await updateVoce.mutateAsync({ id: editingId, titolo: titolo.trim(), testo: testo.trim(), data: data || null })
        toast.success('Voce aggiornata')
      } else {
        await addVoce.mutateAsync({ titolo: titolo.trim(), testo: testo.trim(), data: data || null })
        toast.success('Voce aggiunta')
      }
      resetForm()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <h3 className="text-sm font-semibold text-slate-200">Statistiche mercato</h3>
      <p className="mt-1 text-xs text-slate-400">Voci libere: titolo, testo, data opzionale.</p>
      <div className="mt-2 space-y-2">
        <input value={titolo} onChange={(e) => setTitolo(e.target.value)} placeholder="Titolo" className={inputCls} />
        <textarea
          value={testo}
          onChange={(e) => setTesto(e.target.value)}
          placeholder="Testo"
          rows={3}
          className={inputCls}
        />
        <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={inputCls} />
      </div>
      <div className="mt-2 flex gap-2">
        <button
          onClick={salva}
          disabled={addVoce.isPending || updateVoce.isPending}
          className="flex-1 rounded-lg bg-accent-strong py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {editingId != null ? 'Salva modifiche' : 'Aggiungi voce'}
        </button>
        {editingId != null && (
          <button onClick={resetForm} className="rounded-lg border border-border px-3 py-2 text-sm text-slate-300">
            Annulla
          </button>
        )}
      </div>

      {voci && voci.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {voci.map((v) => (
            <div key={v.id} className="rounded-lg border border-border bg-surface-2 p-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{v.titolo}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-slate-400">{v.testo}</p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button onClick={() => edit(v)} className="text-xs text-accent">
                    Modifica
                  </button>
                  <button onClick={() => deleteVoce.mutate(v.id)} className="text-xs text-rose-300">
                    Elimina
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
