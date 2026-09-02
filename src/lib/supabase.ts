import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  // Aiuta a diagnosticare un .env.local mancante
  console.error('Variabili VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY mancanti')
}

export const FUNCTIONS_URL = `${url}/functions/v1`

export const supabase = createClient<Database>(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Serve per magic link e recupero password: i token arrivano nell'hash
    // dell'URL di redirect e vanno consumati all'avvio.
    detectSessionInUrl: true,
  },
})
