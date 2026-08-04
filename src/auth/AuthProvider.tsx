import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Tables } from '../lib/database.types'

type Manager = Tables<'managers'>

interface AuthContextValue {
  session: Session | null
  manager: Manager | null
  loading: boolean
  isAdmin: boolean
  signIn: (email: string, password: string) => Promise<void>
  /** Ritorna true se la registrazione ha creato subito una sessione attiva
   * (nessuna conferma email richiesta), false se serve confermare via email. */
  signUp: (email: string, password: string) => Promise<boolean>
  signOut: () => Promise<void>
  refreshManager: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [manager, setManager] = useState<Manager | null>(null)
  const [loading, setLoading] = useState(true)

  const loadManager = useCallback(async (uid: string | undefined) => {
    if (!uid) {
      setManager(null)
      return
    }
    const { data } = await supabase.from('managers').select('*').eq('id', uid).maybeSingle()
    setManager(data ?? null)
  }, [])

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return
      setSession(data.session)
      await loadManager(data.session?.user.id)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      void loadManager(newSession?.user.id)
    })
    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [loadManager])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      throw new Error('Email o password non validi')
    }
  }, [])

  const signUp = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) {
      throw new Error(error.message === 'User already registered' ? 'Email già registrata' : error.message)
    }
    return !!data.session
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setManager(null)
  }, [])

  const refreshManager = useCallback(async () => {
    await loadManager(session?.user.id)
  }, [loadManager, session?.user.id])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      manager,
      loading,
      isAdmin: !!manager?.is_admin,
      signIn,
      signUp,
      signOut,
      refreshManager,
    }),
    [session, manager, loading, signIn, signUp, signOut, refreshManager],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve essere usato dentro AuthProvider')
  return ctx
}
