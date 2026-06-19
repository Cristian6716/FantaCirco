import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { Spinner } from '../components/ui'

export default function LoginPage() {
  const { signIn } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await signIn(username, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore di accesso')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-6 pt-safe pb-safe">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="text-5xl">⚽</div>
          <h1 className="mt-3 text-2xl font-bold text-white">Fanta Dinamica</h1>
          <p className="mt-1 text-sm text-slate-400">Asta dinamica degli svincolati</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Username</label>
            <input
              autoCapitalize="none"
              autoCorrect="off"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-white outline-none focus:border-accent"
              placeholder="il tuo username"
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
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          Account creati dall'amministratore. Hai dimenticato la password? Chiedi all'admin.
        </p>
      </div>
    </div>
  )
}
