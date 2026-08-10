import { useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useManagers, useMyCredits, usePlayers, type Player } from '../lib/queries'
import { EmptyState, PageLoader, RoleBadge } from '../components/ui'
import { roleRank } from '../lib/format'

interface Roster {
  team: string
  players: Player[]
  spent: number
}

export default function HomePage() {
  const { manager } = useAuth()
  const { data: players, isLoading } = usePlayers()
  const { data: managers } = useManagers()
  const credits = useMyCredits()
  // Desktop: squadra aperta nel pannello di destra (null = la propria).
  const [selected, setSelected] = useState<string | null>(null)
  // Mobile: squadra espansa nella lista a fisarmonica.
  const [openTeam, setOpenTeam] = useState<string | null>(null)

  const rosters = useMemo(() => {
    const map = new Map<string, Roster>()
    for (const p of players ?? []) {
      if (!p.owner_team) continue
      let r = map.get(p.owner_team)
      if (!r) {
        r = { team: p.owner_team, players: [], spent: 0 }
        map.set(p.owner_team, r)
      }
      r.players.push(p)
      r.spent += p.price ?? 0
    }
    for (const r of map.values()) {
      // Ordine del listone: portieri, difesa, centrocampo, attacco; poi i più pagati.
      r.players.sort(
        (a, b) =>
          roleRank(a.roles) - roleRank(b.roles) ||
          (b.price ?? 0) - (a.price ?? 0) ||
          a.name.localeCompare(b.name, 'it'),
      )
    }
    return [...map.values()].sort((a, b) => a.team.localeCompare(b.team, 'it'))
  }, [players])

  // I crediti residui delle altre squadre: la vista dei crediti è per manager,
  // qui basta il totale del profilo collegato al nome squadra.
  const creditsByTeam = useMemo(
    () => new Map((managers ?? []).map((m) => [m.team_name ?? '', m.credits_total])),
    [managers],
  )

  if (isLoading) return <PageLoader />

  const myTeam = manager?.team_name ?? null
  const mine = rosters.find((r) => r.team === myTeam) ?? null
  const others = rosters.filter((r) => r.team !== myTeam)
  const active = rosters.find((r) => r.team === selected) ?? mine

  return (
    <div className="lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:items-start lg:gap-6">
      {/* Indice delle rose: sempre visibile a lato, un clic apre quella squadra. */}
      <nav className="sticky top-20 hidden lg:block">
        <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Rose
        </p>
        <div className="space-y-0.5">
          {myTeam && (
            <TeamLink
              label={myTeam}
              hint="la tua rosa"
              active={active?.team === myTeam}
              onClick={() => setSelected(null)}
            />
          )}
          {others.map((r) => (
            <TeamLink
              key={r.team}
              label={r.team}
              hint={`${r.players.length} giocatori`}
              active={active?.team === r.team}
              onClick={() => setSelected(active?.team === r.team ? null : r.team)}
            />
          ))}
        </div>
      </nav>

      <div className="min-w-0">
        {/* Desktop: la rosa selezionata occupa il pannello principale. */}
        <div className="hidden lg:block">
          {active ? (
            <TeamPanel
              roster={active}
              isMine={active.team === myTeam}
              available={credits?.available}
              locked={credits?.locked}
              left={creditsByTeam.get(active.team)}
            />
          ) : (
            <EmptyState
              icon="📋"
              title="Nessun giocatore in rosa"
              hint="La rosa compare qui appena l'admin importa i dati della tua squadra."
            />
          )}
        </div>

        {/* Mobile: la propria rosa, poi le altre a fisarmonica. */}
        <div className="space-y-6 lg:hidden">
          {mine ? (
            <TeamPanel
              roster={mine}
              isMine
              available={credits?.available}
              locked={credits?.locked}
              left={creditsByTeam.get(mine.team)}
            />
          ) : (
            <EmptyState
              icon="📋"
              title="Nessun giocatore in rosa"
              hint="La rosa compare qui appena l'admin importa i dati della tua squadra."
            />
          )}

          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              Le altre squadre
            </h2>
            {others.length === 0 ? (
              <EmptyState icon="🫥" title="Nessun'altra rosa disponibile" />
            ) : (
              <div className="space-y-2">
                {others.map((r) => {
                  const open = openTeam === r.team
                  return (
                    <div
                      key={r.team}
                      className="overflow-hidden rounded-xl border border-border bg-surface"
                    >
                      <button
                        onClick={() => setOpenTeam(open ? null : r.team)}
                        aria-expanded={open}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-surface-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className={`truncate font-semibold ${open ? 'text-accent' : 'text-white'}`}>
                            {r.team}
                          </p>
                          <p className="truncate text-xs text-slate-400">
                            {r.players.length} giocatori · {r.spent} spesi
                            {creditsByTeam.has(r.team) ? ` · ${creditsByTeam.get(r.team)} residui` : ''}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 text-xs text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
                        >
                          ▾
                        </span>
                      </button>
                      {open && (
                        <div className="border-t border-border px-3 pb-3 pt-3">
                          <RosterList players={r.players} />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

function TeamLink({
  label,
  hint,
  active,
  onClick,
}: {
  label: string
  hint: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'true' : undefined}
      className={[
        'block w-full rounded-lg px-3 py-2 text-left transition-colors',
        active ? 'bg-accent/15 text-accent' : 'text-slate-300 hover:bg-surface-2',
      ].join(' ')}
    >
      <span className="block truncate text-sm font-semibold">{label}</span>
      <span className="block truncate text-[11px] text-slate-500">{hint}</span>
    </button>
  )
}

function TeamPanel({
  roster,
  isMine,
  available,
  locked,
  left,
}: {
  roster: Roster
  isMine: boolean
  available?: number | null
  locked?: number | null
  left?: number
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="truncate text-xl font-bold text-white">{roster.team}</h1>
        <span className="shrink-0 text-xs text-slate-400">{roster.players.length} giocatori</span>
      </div>

      <div className="grid grid-cols-3 divide-x divide-border overflow-hidden rounded-xl border border-border bg-surface">
        {isMine ? (
          <>
            <Stat label="Disponibili" value={available} color="text-accent" />
            <Stat label="Bloccati" value={locked} color="text-amber-300" />
            <Stat label="Spesi all'asta" value={roster.spent} color="text-slate-200" />
          </>
        ) : (
          <>
            <Stat label="Giocatori" value={roster.players.length} color="text-slate-200" />
            <Stat label="Spesi all'asta" value={roster.spent} color="text-slate-200" />
            <Stat label="Residui" value={left} color="text-accent" />
          </>
        )}
      </div>

      <RosterList players={roster.players} />
    </section>
  )
}

function Stat({
  label,
  value,
  color,
}: {
  label: string
  value: number | null | undefined
  color: string
}) {
  return (
    <div className="flex flex-col items-center justify-center px-2 py-2.5">
      <span className={`text-lg font-bold leading-tight ${color}`}>{value ?? '–'}</span>
      <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</span>
    </div>
  )
}

function RosterList({ players }: { players: Player[] }) {
  return (
    <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
      {players.map((p) => (
        <div key={p.id} className="flex items-center gap-2.5 px-3 py-2">
          <RoleBadge roles={p.roles} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{p.name}</p>
            <p className="truncate text-xs text-slate-400">
              {p.real_team ?? '—'}
              {p.quotazione_mantra != null && ` · qt ${p.quotazione_mantra}`}
            </p>
          </div>
          <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-200">
            {p.price ?? 0}
          </span>
        </div>
      ))}
    </div>
  )
}
