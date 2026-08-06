import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useState, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useMyCredits, useRealtime } from '../lib/queries'
import { useLeagueRealtime } from '../lib/leagueQueries'
import { usePodioRealtime } from '../lib/podio'
import { useRankingRealtime } from '../lib/rankingQueries'

function CreditStat({ label, value, color }: { label: string; value: number | null | undefined; color: string }) {
  return (
    <div className="flex min-w-[3.25rem] flex-col items-center justify-center px-3 py-1.5">
      <span className={`text-lg font-bold leading-tight ${color}`}>{value ?? '–'}</span>
      <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</span>
    </div>
  )
}

function Header({ onMenu }: { onMenu: () => void }) {
  const { manager } = useAuth()
  const credits = useMyCredits()
  const navigate = useNavigate()
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur">
      <div className="pt-safe">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-3 py-2.5 lg:max-w-4xl xl:max-w-5xl">
          <button
            onClick={onMenu}
            aria-label="Apri menù"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xl text-slate-200 active:scale-95 lg:hidden"
          >
            ☰
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-tight text-white lg:hidden">🎪 FantaCirco</p>
            <p className="truncate text-xs leading-tight text-slate-400">
              {manager?.team_name || manager?.display_name}
            </p>
          </div>
          <button
            onClick={() => navigate('/profilo')}
            className="flex shrink-0 items-stretch divide-x divide-border overflow-hidden rounded-xl border border-border bg-surface active:scale-[0.98]"
          >
            <CreditStat label="Disp." value={credits?.available} color="text-accent" />
            <CreditStat label="Bloc." value={credits?.locked ?? 0} color="text-amber-300" />
          </button>
        </div>
      </div>
    </header>
  )
}

interface SubItem {
  to: string
  label: string
}

interface Section {
  key: string
  label: string
  icon: string
  to?: string
  items?: SubItem[]
}

function DrawerLink({ to, label, onNavigate }: { to: string; label: string; onNavigate: () => void }) {
  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={({ isActive }) =>
        [
          'block rounded-lg px-3 py-2 text-sm transition-colors',
          isActive ? 'bg-accent/15 font-semibold text-accent' : 'text-slate-300 active:bg-surface-2',
        ].join(' ')
      }
    >
      {label}
    </NavLink>
  )
}

function DrawerSection({
  section,
  expanded,
  onToggle,
  onNavigate,
}: {
  section: Section
  expanded: boolean
  onToggle: () => void
  onNavigate: () => void
}) {
  const location = useLocation()

  if (!section.items) {
    return (
      <NavLink
        to={section.to!}
        onClick={onNavigate}
        className={({ isActive }) =>
          [
            'flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
            isActive ? 'bg-accent/15 text-accent' : 'text-white active:bg-surface-2',
          ].join(' ')
        }
      >
        <span className="text-lg">{section.icon}</span>
        {section.label}
      </NavLink>
    )
  }

  const isCurrentSection = section.items.some((i) => location.pathname.startsWith(i.to))

  return (
    <div>
      <button
        onClick={onToggle}
        className={[
          'flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-colors',
          isCurrentSection ? 'text-accent' : 'text-white',
          'active:bg-surface-2',
        ].join(' ')}
      >
        <span className="text-lg">{section.icon}</span>
        <span className="flex-1">{section.label}</span>
        <span className={`text-xs transition-transform ${expanded ? 'rotate-180' : ''}`}>▾</span>
      </button>
      {expanded && (
        <div className="mt-1 space-y-0.5 pl-9">
          {section.items.map((item) => (
            <DrawerLink key={item.to} to={item.to} label={item.label} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  )
}

const SECTIONS: Section[] = [
  {
    key: 'asta',
    label: 'Asta',
    icon: '🔨',
    items: [
      { to: '/asta/giocatori', label: 'Giocatori' },
      { to: '/asta/aste', label: 'Aste' },
    ],
  },
  {
    key: 'pronostici',
    label: 'Pronostici',
    icon: '🎯',
    items: [
      { to: '/pronostici/pronostica', label: 'Pronostica' },
      { to: '/pronostici/classifica', label: 'Classifica' },
      { to: '/pronostici/storico', label: 'Storico' },
      { to: '/pronostici/podio', label: 'Podio' },
    ],
  },
  { key: 'tornei', label: 'Tornei', icon: '🏆', to: '/tornei' },
  { key: 'ranking', label: 'Ranking', icon: '📊', to: '/ranking' },
]

/** Elenco sezioni + link di piede, condiviso dal drawer mobile e dalla sidebar desktop. */
function NavContent({ onNavigate }: { onNavigate: () => void }) {
  const location = useLocation()
  const { isAdmin, signOut } = useAuth()
  // La sezione della route attiva è espansa di default; un toggle manuale la
  // sovrascrive finché non si naviga altrove (niente effetto: derivato al render).
  const [overrides, setOverrides] = useState<Record<string, boolean>>({})

  return (
    <>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {SECTIONS.map((s) => {
          const isCurrentSection = !!s.items?.some((i) => location.pathname.startsWith(i.to))
          const expanded = overrides[s.key] ?? isCurrentSection
          return (
            <DrawerSection
              key={s.key}
              section={s}
              expanded={expanded}
              onToggle={() => setOverrides((o) => ({ ...o, [s.key]: !expanded }))}
              onNavigate={onNavigate}
            />
          )
        })}
      </nav>

      <div className="space-y-1 border-t border-border px-3 py-3">
        {isAdmin && <DrawerLink to="/admin" label="⚙️ Admin" onNavigate={onNavigate} />}
        <DrawerLink to="/profilo" label="👤 Profilo" onNavigate={onNavigate} />
        <button
          onClick={() => {
            onNavigate()
            void signOut()
          }}
          className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-400 active:bg-surface-2"
        >
          Esci
        </button>
      </div>
    </>
  )
}

function Drawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <div className="lg:hidden">
      <div
        className={[
          'fixed inset-0 z-40 bg-black/60 transition-opacity',
          open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
        ].join(' ')}
        onClick={onClose}
      />
      <aside
        className={[
          'fixed inset-y-0 left-0 z-50 flex w-[80vw] max-w-xs flex-col border-r border-border bg-surface pt-safe pb-safe transition-transform duration-200',
          open ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        <div className="flex items-center justify-between px-4 py-3">
          <p className="text-sm font-semibold text-white">🎪 FantaCirco</p>
          <button
            onClick={onClose}
            aria-label="Chiudi menù"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-lg text-slate-300"
          >
            ✕
          </button>
        </div>
        <NavContent onNavigate={onClose} />
      </aside>
    </div>
  )
}

/** Sidebar sempre visibile su schermi larghi, al posto del drawer a scomparsa. */
function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-surface pt-safe lg:flex">
      <div className="px-4 py-3">
        <p className="text-sm font-semibold text-white">🎪 FantaCirco</p>
      </div>
      <NavContent onNavigate={() => {}} />
    </aside>
  )
}

export function Layout({ children }: { children: ReactNode }) {
  useRealtime()
  useLeagueRealtime()
  usePodioRealtime()
  useRankingRealtime()
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className="flex min-h-full">
      <Sidebar />
      <div className="flex min-h-full flex-1 flex-col">
        <Header onMenu={() => setDrawerOpen(true)} />
        <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-4 lg:max-w-4xl xl:max-w-5xl">{children}</main>
      </div>
    </div>
  )
}
