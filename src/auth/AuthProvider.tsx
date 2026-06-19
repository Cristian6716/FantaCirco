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
import { supabase, usernameToEmail } from '../lib/supabase'
import type { Tables } from '../lib/database.types'

type Manager = Tables<'managers'>

interface AuthContextValue {
  session: Session | null
  manager: Manager | null
  loading: boolean
  isAdmin: boolean
  signIn: (username: string, password: string) => Promise<void>
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

  const signIn = useCallback(async (username: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: usernameToEmail(username),
      password,
    })
    if (error) {
      throw new Error('Username o password non validi')
    }
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
      signOut,
      refreshManager,
    }),
    [session, manager, loading, signIn, signOut, refreshManager],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve essere usato dentro AuthProvider')
  return ctx
}
