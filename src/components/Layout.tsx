import { NavLink, useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useMyCredits, useRealtime } from '../lib/queries'

function CreditStat({ label, value, color }: { label: string; value: number | null | undefined; color: string }) {
  return (
    <div className="flex min-w-[3.25rem] flex-col items-center justify-center px-3 py-1.5">
      <span className={`text-lg font-bold leading-tight ${color}`}>{value ?? '–'}</span>
      <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</span>
    </div>
  )
}

function CreditsHeader() {
  const { manager } = useAuth()
  const credits = useMyCredits()
  const navigate = useNavigate()
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur">
      <div className="pt-safe">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight text-white">⚽ Fanta Dinamica</p>
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

function NavItem({ to, label, icon, end }: { to: string; label: string; icon: string; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        [
          'flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors',
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
      <main className="pb-nav mx-auto w-full max-w-2xl flex-1 px-4 py-4">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl pb-safe">
          <NavItem to="/" label="Aste" icon="🔨" end />
          <NavItem to="/giocatori" label="Giocatori" icon="📋" />
          {isAdmin && <NavItem to="/admin" label="Admin" icon="⚙️" />}
          <NavItem to="/profilo" label="Profilo" icon="👤" />
        </div>
      </nav>
    </div>
  )
}
