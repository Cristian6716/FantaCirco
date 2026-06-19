import type { Enums } from './database.types'

// ---- Ruoli Mantra ----
export const MANTRA_ROLES = ['Por', 'Dd', 'Ds', 'Dc', 'B', 'E', 'M', 'C', 'W', 'T', 'A', 'Pc'] as const
export type MantraRole = (typeof MANTRA_ROLES)[number]

export type Macro = 'P' | 'D' | 'C' | 'A'

// macro-ruolo (per colore e filtri)
export const ROLE_MACRO: Record<string, Macro> = {
  Por: 'P',
  Dd: 'D',
  Ds: 'D',
  Dc: 'D',
  B: 'D',
  E: 'C',
  M: 'C',
  C: 'C',
  W: 'C',
  T: 'C',
  A: 'A',
  Pc: 'A',
}

export const MACRO_LABEL: Record<Macro, string> = {
  P: 'Portiere',
  D: 'Difensore',
  C: 'Centrocampista',
  A: 'Attaccante',
}

export const MACRO_COLOR: Record<Macro, string> = {
  P: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  D: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  C: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  A: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
}

export function roleColor(role: string): string {
  return MACRO_COLOR[ROLE_MACRO[role] ?? 'C']
}

export function macroOf(roles: string[] | null | undefined): Macro | null {
  if (!roles || roles.length === 0) return null
  return ROLE_MACRO[roles[0]] ?? null
}

/** Normalizza un token grezzo del listone in un codice ruolo Mantra. */
export function normalizeRole(token: string): MantraRole | null {
  const t = token.trim().toLowerCase()
  return MANTRA_ROLES.find((r) => r.toLowerCase() === t) ?? null
}

/** Estrae i ruoli Mantra da un campo testo (es. "Dd/Ds" o "M;C"). */
export function parseRoles(field: string): string[] {
  return field
    .split(/[;/|\s]+/)
    .map((x) => normalizeRole(x))
    .filter((x): x is MantraRole => !!x)
}

// ---- Stato asta ----
export function statusLabel(status: Enums<'auction_status'>): string {
  switch (status) {
    case 'phase1':
      return 'Fase 1'
    case 'phase2':
      return 'Fase 2'
    case 'paused':
      return 'In pausa'
    case 'ended':
      return 'Conclusa'
    case 'cancelled':
      return 'Annullata'
  }
}

export const isActive = (status: Enums<'auction_status'>) =>
  status === 'phase1' || status === 'phase2' || status === 'paused'

// ---- Tempo ----
/** Conto alla rovescia compatto: "1g 3h", "3h 12m", "12m 04s", "scaduta" */
export function countdown(target: string | Date, now: number = Date.now()): string {
  const end = typeof target === 'string' ? new Date(target).getTime() : target.getTime()
  let s = Math.floor((end - now) / 1000)
  if (s <= 0) return 'scaduta'
  const d = Math.floor(s / 86400)
  s -= d * 86400
  const h = Math.floor(s / 3600)
  s -= h * 3600
  const m = Math.floor(s / 60)
  s -= m * 60
  if (d > 0) return `${d}g ${h}h`
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  return `${m}m ${String(s).padStart(2, '0')}s`
}

export function formatDateTime(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value
  return d.toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatTime(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value
  return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
}
