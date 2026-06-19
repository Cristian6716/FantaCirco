import { NavLink, useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useMyCredits, useRealtime } from '../lib/queries'

function CreditsHeader() {
  const { manager } = useAuth()
  const credits = useMyCredits()
  const navigate = useNavigate()
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur pt-safe">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">⚽ Fanta Dinamica</p>
          <p className="truncate text-xs text-slate-400">
            {manager?.team_name || manager?.display_name}
          </p>
        </div>
        <button
          onClick={() => navigate('/profilo')}
          className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-1.5 text-right active:scale-[0.98]"
        >
          <div>
            <p className="text-[10px] uppercase tracking-wide text-slate-400">Disponibili</p>
            <p className="text-lg font-bold leading-none text-accent">
              {credits?.available ?? '–'}
            </p>
          </div>
          {!!credits?.locked && (
            <div className="border-l border-border pl-3">
              <p className="text-[10px] uppercase tracking-wide text-slate-400">Bloccati</p>
              <p className="text-sm font-semibold leading-none text-amber-300">{credits.locked}</p>
            </div>
          )}
        </button>
      </div>
    </header>
  )
}

function NavItem({ to, label, icon, end }: { to: string; label: string; icon: string; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        [
          'flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition-colors',
          isActive ? 'text-accent' : 'text-slate-400',
        ].join(' ')
      }
    >
      <span className="text-xl leading-none">{icon}</span>
      {label}
    </NavLink>
  )
}

export function Layout({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth()
  useRealtime()
  return (
    <div className="flex min-h-full flex-col">
      <CreditsHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-4 pb-28">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg/95 backdrop-blur pb-safe">
        <div className="mx-auto flex max-w-2xl">
          <NavItem to="/" label="Aste" icon="🔨" end />
          <NavItem to="/giocatori" label="Giocatori" icon="📋" />
          {isAdmin && <NavItem to="/admin" label="Admin" icon="⚙️" />}
          <NavItem to="/profilo" label="Profilo" icon="👤" />
        </div>
      </nav>
    </div>
  )
}
