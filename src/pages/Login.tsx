import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { Spinner } from '../components/ui'
import { supabase } from '../lib/supabase'

// Fase di prova: accesso senza password. Si entra toccando la propria squadra;
// la password (condivisa) viene usata in automatico. Reversibile: per andare
// "sul serio" basta dare a ciascuno la propria password e togliere il picker.
const TRIAL_PASSWORD = 'fantaprova2026'

interface Profile {
  username: string
  display_name: string
  team_name: string | null
}

export default function LoginPage() {
  const { signIn } = useAuth()
  const [profiles, setProfiles] = useState<Profile[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [adminMode, setAdminMode] = useState(false)

  useEffect(() => {
    supabase.rpc('list_login_profiles').then(({ data }) => {
      setProfiles((data as Profile[]) ?? [])
    })
  }, [])

  async function enter(username: string) {
    setError(null)
    setBusy(username)
    try {
      await signIn(username, TRIAL_PASSWORD)
    } catch {
      setError('Impossibile accedere a questo profilo.')
      setBusy(null)
    }
  }

  // Form admin (accesso classico username + password)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await signIn(username, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore di accesso')
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col px-5 pt-safe pb-safe">
      <div className="pt-10 pb-6 text-center">
        <div className="text-5xl">⚽</div>
        <h1 className="mt-3 text-2xl font-bold text-white">Fanta Dinamica</h1>
        <p className="mt-1 text-sm text-slate-400">Asta dinamica degli svincolati</p>
      </div>

      {!adminMode ? (
        <>
          <p className="mb-3 text-center text-sm font-medium text-slate-300">
            Scegli la tua squadra per entrare
          </p>

          {profiles === null ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : profiles.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">
              Nessun profilo disponibile. Usa l'accesso amministratore.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              {profiles.map((p) => {
                const label = p.team_name || p.display_name
                const isBusy = busy === p.username
                return (
                  <button
                    key={p.username}
                    onClick={() => enter(p.username)}
                    disabled={!!busy}
                    className="flex min-h-[3.5rem] items-center justify-center rounded-xl border border-border bg-surface px-3 py-2 text-center text-sm font-semibold text-white transition active:scale-[0.97] disabled:opacity-50"
                  >
                    {isBusy ? <Spinner /> : label}
                  </button>
                )
              })}
            </div>
          )}

          {error && (
            <p className="mt-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-center text-sm text-rose-200">
              {error}
            </p>
          )}

          <button
            onClick={() => {
              setAdminMode(true)
              setError(null)
            }}
            className="mt-8 text-center text-xs text-slate-500 underline-offset-2 hover:underline"
          >
            Accesso amministratore
          </button>
        </>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Username</label>
            <input
              autoCapitalize="none"
              autoCorrect="off"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-white outline-none focus:border-accent"
              placeholder="username admin"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-white outline-none focus:border-accent"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent-strong py-3 font-semibold text-white active:scale-[0.98] disabled:opacity-60"
          >
            {loading ? <Spinner /> : 'Accedi'}
          </button>

          <button
            type="button"
            onClick={() => {
              setAdminMode(false)
              setError(null)
            }}
            className="w-full pt-2 text-center text-xs text-slate-500 underline-offset-2 hover:underline"
          >
            ← Torna alla lista squadre
          </button>
        </form>
      )}
    </div>
  )
}
