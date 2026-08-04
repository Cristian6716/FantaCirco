import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { Spinner } from '../components/ui'

type Mode = 'signin' | 'signup'

export default function LoginPage() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checkEmail, setCheckEmail] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (mode === 'signup' && password !== password2) {
      setError('Le password non coincidono')
      return
    }
    if (password.length < 6) {
      setError('La password deve avere almeno 6 caratteri')
      return
    }

    setLoading(true)
    try {
      if (mode === 'signin') {
        await signIn(email, password)
      } else {
        const hasSession = await signUp(email, password)
        if (!hasSession) {
          setCheckEmail(true)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore')
    } finally {
      setLoading(false)
    }
  }

  if (checkEmail) {
    return (
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col px-5 pt-safe pb-safe">
        <div className="pt-10 pb-6 text-center">
          <div className="text-5xl">🎪</div>
          <h1 className="mt-3 text-2xl font-bold text-white">FantaCirco</h1>
        </div>
        <div className="rounded-2xl border border-accent/40 bg-accent/10 p-4 text-center">
          <p className="text-sm font-semibold text-accent">Controlla la tua email</p>
          <p className="mt-2 text-sm text-slate-300">
            Ti abbiamo inviato un link di conferma a <b>{email}</b>. Confermalo e poi accedi da qui.
          </p>
        </div>
        <button
          onClick={() => {
            setCheckEmail(false)
            setMode('signin')
            setPassword('')
            setPassword2('')
          }}
          className="mt-6 w-full rounded-xl bg-accent-strong py-3 font-semibold text-white active:scale-[0.98]"
        >
          Torna al login
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col px-5 pt-safe pb-safe">
      <div className="pt-10 pb-6 text-center">
        <div className="text-5xl">🎪</div>
        <h1 className="mt-3 text-2xl font-bold text-white">FantaCirco</h1>
        <p className="mt-1 text-sm text-slate-400">Asta dinamica del fantacalcio</p>
      </div>

      <div className="mb-4 flex rounded-xl border border-border bg-surface p-1 text-sm">
        <button
          onClick={() => {
            setMode('signin')
            setError(null)
          }}
          className={[
            'flex-1 rounded-lg py-2 font-medium transition-colors',
            mode === 'signin' ? 'bg-accent-strong text-white' : 'text-slate-400',
          ].join(' ')}
        >
          Accedi
        </button>
        <button
          onClick={() => {
            setMode('signup')
            setError(null)
          }}
          className={[
            'flex-1 rounded-lg py-2 font-medium transition-colors',
            mode === 'signup' ? 'bg-accent-strong text-white' : 'text-slate-400',
          ].join(' ')}
        >
          Registrati
        </button>
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Email</label>
          <input
            type="email"
            autoCapitalize="none"
            autoCorrect="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-white outline-none focus:border-accent"
            placeholder="la-tua-email@esempio.it"
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
        {mode === 'signup' && (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Ripeti password</label>
            <input
              type="password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-white outline-none focus:border-accent"
              placeholder="••••••••"
              required
            />
          </div>
        )}

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
          {loading ? <Spinner /> : mode === 'signin' ? 'Accedi' : 'Crea account'}
        </button>

        {mode === 'signup' && (
          <p className="pt-1 text-center text-xs text-slate-500">
            Dopo la registrazione sceglierai la tua squadra: la scelta sarà definitiva.
          </p>
        )}
      </form>
    </div>
  )
}
