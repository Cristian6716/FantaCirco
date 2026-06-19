import { useEffect, useState } from 'react'
import type { Enums } from '../lib/database.types'
import { countdown, ROLE_COLOR, ROLE_SHORT, statusLabel } from '../lib/format'

export function Countdown({ target, className }: { target: string; className?: string }) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(i)
  }, [])
  const text = countdown(target)
  return <span className={className}>{text}</span>
}

export function RoleBadge({ role }: { role: Enums<'player_role'> | null }) {
  if (!role) return null
  return (
    <span
      className={`inline-flex h-6 w-6 items-center justify-center rounded-md border text-xs font-bold ${ROLE_COLOR[role]}`}
    >
      {ROLE_SHORT[role]}
    </span>
  )
}

export function StatusBadge({ status }: { status: Enums<'auction_status'> }) {
  const styles: Record<Enums<'auction_status'>, string> = {
    phase1: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    phase2: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    paused: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
    ended: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
    cancelled: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
  }
  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${styles[status]}`}>
      {statusLabel(status)}
    </span>
  )
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <div
      className={`inline-block h-5 w-5 animate-spin rounded-full border-2 border-slate-500 border-t-transparent ${className}`}
    />
  )
}

export function PageLoader() {
  return (
    <div className="flex flex-1 items-center justify-center py-20">
      <Spinner className="h-8 w-8" />
    </div>
  )
}

export function EmptyState({ icon, title, hint }: { icon?: string; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      {icon && <div className="text-4xl">{icon}</div>}
      <p className="font-medium text-slate-200">{title}</p>
      {hint && <p className="text-sm text-slate-400">{hint}</p>}
    </div>
  )
}
