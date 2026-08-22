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

/**
 * Colori dei ruoli Mantra, gli stessi che usa Fantacalcio.it sul listone.
 * Ala e trequartista condividono il viola, come sul sito ufficiale.
 */
export const ROLE_COLOR: Record<string, string> = {
  Por: '#F0A02A',
  Dd: '#12A79D',
  Ds: '#12A79D',
  Dc: '#2FA84F',
  B: '#7CB342',
  E: '#29A3E0',
  M: '#2B4EA2',
  C: '#3D7FD6',
  W: '#8A4FC8',
  T: '#8A4FC8',
  A: '#E0447B',
  Pc: '#E03A34',
}

/** Colore di sfondo del badge di un ruolo (grigio per un codice sconosciuto). */
export function roleColor(role: string): string {
  return ROLE_COLOR[role] ?? '#64748B'
}

/** Ordina i giocatori come il listone: portieri, difesa, centrocampo, attacco. */
export function roleRank(roles: string[] | null | undefined): number {
  if (!roles || roles.length === 0) return MANTRA_ROLES.length
  const i = MANTRA_ROLES.indexOf(roles[0] as MantraRole)
  return i === -1 ? MANTRA_ROLES.length : i
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

/**
 * Converte un ISO in valore per <input type="datetime-local">, che lavora in
 * ora locale senza fuso: tolgo l'offset del browser prima di troncare.
 */
export function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return ''
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}
