import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useMyCredits, useNotificationPreferences, useSetNotificationPreference } from '../lib/queries'
import { useMyRanking } from '../lib/rankingQueries'
import { useToast } from '../components/Toast'
import { Spinner } from '../components/ui'
import { changeMyPassword } from '../lib/api'
import {
  currentSubscription,
  disablePush,
  enablePush,
  isIOS,
  isPushSupported,
  isStandalone,
  pushConfigured,
} from '../lib/push'

export default function ProfilePage() {
  const { manager, signOut } = useAuth()
  const credits = useMyCredits()
  const ranking = useMyRanking()
  const toast = useToast()

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-white">Profilo</h1>

      <div className="rounded-2xl border border-border bg-surface p-4">
        <p className="text-lg font-semibold text-white">{manager?.display_name}</p>
        <p className="text-sm text-slate-400">@{manager?.username}</p>
        {manager?.team_name && <p className="mt-1 text-sm text-slate-300">🛡️ {manager.team_name}</p>}
        {manager?.is_admin && (
          <span className="mt-2 inline-block rounded-full border border-accent/50 bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">
            Amministratore
          </span>
        )}

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Stat label="Totali" value={credits?.credits_total} />
          <Stat label="Bloccati" value={credits?.locked} color="text-amber-300" />
          <Stat label="Disponibili" value={credits?.available} color="text-accent" />
        </div>
        <p className="mt-3 text-center text-xs text-slate-400">
          Rosa: {credits?.roster_used ?? 0}/{credits?.roster_max ?? 0} slot occupati (giocatori
          vinti + aste in corso). I crediti bloccati includono i tetti degli auto-bid attivi.
        </p>
      </div>

      {ranking && (
        <div className="flex items-center justify-between rounded-2xl border border-border bg-surface p-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-200">Ranking generale 📊</h2>
            <p className="mt-0.5 text-xs text-slate-400">{ranking.pos}° posizione su tutte le squadre</p>
          </div>
          <p className="text-2xl font-bold text-accent">{ranking.totale}</p>
        </div>
      )}

      <NotificationsCard />
      <PasswordCard onDone={() => toast.success('Password aggiornata')} />

      <button
        onClick={signOut}
        className="w-full rounded-xl border border-border bg-surface py-3 text-sm font-medium text-slate-200 active:scale-[0.98]"
      >
        Esci
      </button>
    </div>
  )
}

function Stat({ label, value, color = 'text-white' }: { label: string; value?: number | null; color?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface-2 py-2.5">
      <p className={`text-2xl font-bold leading-none ${color}`}>{value ?? '–'}</p>
      <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
    </div>
  )
}

function NotificationsCard() {
  const { manager } = useAuth()
  const toast = useToast()
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(false)
  const supported = isPushSupported()
  const configured = pushConfigured()
  const standalone = isStandalone()
  const ios = isIOS()
  const iosNeedsInstall = ios && !standalone

  useEffect(() => {
    currentSubscription().then((s) => setEnabled(!!s))
  }, [])

  async function toggle() {
    if (!manager) return
    setLoading(true)
    try {
      if (enabled) {
        await disablePush()
        setEnabled(false)
        toast.success('Notifiche disattivate')
      } else {
        await enablePush(manager.id)
        setEnabled(true)
        toast.success('Notifiche attivate')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold text-slate-200">Notifiche push 🔔</h2>
      <p className="mt-1 text-xs text-slate-400">
        Attiva le notifiche sul dispositivo e scegli quali ricevere qui sotto.
      </p>

      {iosNeedsInstall ? (
        <p className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          📱 Su iPhone le notifiche funzionano solo dopo aver aggiunto l'app alla schermata Home
          (Condividi → «Aggiungi a Home»), e serve iOS 16.4 o superiore. Riapri l'app dall'icona
          in Home per attivarle.
        </p>
      ) : !supported ? (
        <p className="mt-3 rounded-lg border border-slate-500/40 bg-slate-500/10 px-3 py-2 text-xs text-slate-300">
          Questo browser non supporta le notifiche.
        </p>
      ) : !configured ? (
        <p className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          Notifiche non ancora configurate dall'amministratore.
        </p>
      ) : (
        <button
          onClick={toggle}
          disabled={loading}
          className={[
            'mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold active:scale-[0.98] disabled:opacity-60',
            enabled
              ? 'border border-border bg-surface-2 text-slate-200'
              : 'bg-accent-strong text-white',
          ].join(' ')}
        >
          {loading ? <Spinner /> : enabled ? 'Disattiva notifiche' : 'Attiva notifiche'}
        </button>
      )}

      {supported && configured && (
        <div className="mt-4 space-y-2 border-t border-border pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Tipi di notifica
          </p>

          <NotificationRow
            label="Inizio nuova asta"
            hint="Sempre attiva per tutti, non disattivabile."
            locked
          />
          <NotificationToggleRow
            field="notify_outbid_phase1"
            label="Superato (prime 24h)"
            hint="Quando qualcuno rilancia sopra la tua offerta nella fase 1."
          />
          <NotificationToggleRow
            field="notify_phase2_start"
            label="Fine prime 24h"
            hint="Quando l'asta entra nelle seconde 24h (fase 2)."
          />
          <NotificationToggleRow
            field="notify_outbid_phase2"
            label="Superato (seconde 24h)"
            hint="Quando qualcuno rilancia sopra la tua offerta nella fase 2."
          />
          <NotificationToggleRow
            field="notify_mercato_annuncio"
            label="Nuovo giocatore sul mercato"
            hint="Quando qualcuno mette in vetrina un giocatore scambiabile."
            defaultValue={false}
          />
          <NotificationToggleRow
            field="notify_promemoria_pronostici"
            label="Promemoria pronostici"
            hint="3 ore prima della chiusura: pronostici da mandare e formazione da mettere."
          />
        </div>
      )}
    </div>
  )
}

function NotificationRow({
  label,
  hint,
  checked,
  locked,
  onToggle,
  loading,
}: {
  label: string
  hint: string
  checked?: boolean
  locked?: boolean
  onToggle?: () => void
  loading?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <div className="min-w-0">
        <p className="text-sm text-slate-200">{label}</p>
        <p className="text-xs text-slate-500">{hint}</p>
      </div>
      {locked ? (
        <span className="shrink-0 rounded-full border border-border bg-surface-2 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
          Sempre attiva
        </span>
      ) : (
        <button
          type="button"
          role="switch"
          aria-checked={!!checked}
          disabled={loading}
          onClick={onToggle}
          className={[
            'relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60',
            checked ? 'bg-accent-strong' : 'bg-surface-2 border border-border',
          ].join(' ')}
        >
          <span
            className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform"
            style={{ transform: checked ? 'translateX(22px)' : 'translateX(0)' }}
          />
        </button>
      )}
    </div>
  )
}

function NotificationToggleRow({
  field,
  label,
  hint,
  defaultValue = true,
}: {
  field:
    | 'notify_outbid_phase1'
    | 'notify_phase2_start'
    | 'notify_outbid_phase2'
    | 'notify_mercato_annuncio'
    | 'notify_promemoria_pronostici'
  label: string
  hint: string
  /** Valore mostrato finche' non esiste una riga di preferenze per il manager. */
  defaultValue?: boolean
}) {
  const toast = useToast()
  const { data: prefs } = useNotificationPreferences()
  const setPref = useSetNotificationPreference()
  const checked = prefs?.[field] ?? defaultValue

  return (
    <NotificationRow
      label={label}
      hint={hint}
      checked={checked}
      loading={setPref.isPending}
      onToggle={() =>
        setPref.mutate(
          { [field]: !checked },
          { onError: (err) => toast.error(err instanceof Error ? err.message : 'Errore') },
        )
      }
    />
  )
}

function PasswordCard({ onDone }: { onDone: () => void }) {
  const toast = useToast()
  const [pwd, setPwd] = useState('')
  const [pwd2, setPwd2] = useState('')
  const [loading, setLoading] = useState(false)

  async function save() {
    if (pwd.length < 4) return toast.error('Minimo 4 caratteri')
    if (pwd !== pwd2) return toast.error('Le password non coincidono')
    setLoading(true)
    try {
      await changeMyPassword(pwd)
      setPwd('')
      setPwd2('')
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold text-slate-200">Cambia password</h2>
      <input
        type="password"
        value={pwd}
        onChange={(e) => setPwd(e.target.value)}
        placeholder="Nuova password"
        className="mt-3 w-full rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-sm text-white outline-none focus:border-accent"
      />
      <input
        type="password"
        value={pwd2}
        onChange={(e) => setPwd2(e.target.value)}
        placeholder="Ripeti password"
        className="mt-2 w-full rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-sm text-white outline-none focus:border-accent"
      />
      <button
        onClick={save}
        disabled={loading || !pwd}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-accent-strong py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {loading ? <Spinner /> : 'Aggiorna password'}
      </button>
    </div>
  )
}
