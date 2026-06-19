import { formatDateTime } from './format'

export function auctionUrl(auctionId: number): string {
  return `${window.location.origin}/asta/${auctionId}`
}

export function buildWhatsappMessage(opts: {
  playerName: string
  team?: string | null
  base: number
  auctionId: number
  phase1EndsAt: string
}): string {
  const url = auctionUrl(opts.auctionId)
  const team = opts.team ? ` (${opts.team})` : ''
  return (
    `🔨 *Asta aperta* per *${opts.playerName}*${team}!\n` +
    `Base: ${opts.base} crediti\n` +
    `⏰ Fase 1 (tutti) fino al ${formatDateTime(opts.phase1EndsAt)}\n` +
    `Partecipa qui 👉 ${url}`
  )
}

/** Apre WhatsApp con il messaggio pre-compilato (l'utente sceglie il gruppo). */
export function shareOnWhatsapp(message: string) {
  const url = `https://wa.me/?text=${encodeURIComponent(message)}`
  window.open(url, '_blank', 'noopener,noreferrer')
}
