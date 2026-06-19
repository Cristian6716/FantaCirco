// Edge Function: crea un account "manager".
// - Bootstrap: se non esiste alcun manager, il primo creato diventa admin (nessun token richiesto).
// - Successivamente: richiede il token di un admin nell'header Authorization.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Metodo non consentito' }, 405)

  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

    const body = await req.json().catch(() => ({}))
    const username = String(body.username ?? '').toLowerCase().trim()
    const display_name = String(body.display_name ?? '').trim()
    const team_name = body.team_name ? String(body.team_name).trim() : null
    const credits = Number.isFinite(body.credits) ? Math.max(0, Math.floor(body.credits)) : 0
    const password = String(body.password ?? '')
    const wantsAdmin = body.is_admin === true

    if (!username || !display_name || !password) {
      return json({ error: 'username, display_name e password sono obbligatori' }, 400)
    }
    if (password.length < 4) {
      return json({ error: 'La password deve avere almeno 4 caratteri' }, 400)
    }

    const { count, error: cErr } = await admin
      .from('managers')
      .select('*', { count: 'exact', head: true })
    if (cErr) throw cErr
    const bootstrap = (count ?? 0) === 0

    if (!bootstrap) {
      const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
      if (!token) return json({ error: 'Non autorizzato' }, 401)
      const { data: userData, error: uErr } = await admin.auth.getUser(token)
      if (uErr || !userData?.user) return json({ error: 'Non autorizzato' }, 401)
      const { data: me } = await admin
        .from('managers')
        .select('is_admin')
        .eq('id', userData.user.id)
        .single()
      if (!me?.is_admin) return json({ error: 'Solo un admin puo creare utenti' }, 403)
    }

    const email = `${username}@fanta.local`
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name },
    })
    if (createErr || !created?.user) {
      return json({ error: createErr?.message ?? 'Errore creazione utente' }, 400)
    }

    const { error: insErr } = await admin.from('managers').insert({
      id: created.user.id,
      username,
      display_name,
      team_name,
      credits_total: credits,
      is_admin: bootstrap ? true : wantsAdmin,
    })
    if (insErr) {
      await admin.auth.admin.deleteUser(created.user.id)
      return json({ error: insErr.message }, 400)
    }

    return json({ ok: true, id: created.user.id, username, email, is_admin: bootstrap ? true : wantsAdmin }, 200)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
