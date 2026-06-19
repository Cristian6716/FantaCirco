// Edge Function: invia le notifiche Web Push in coda (push_outbox).
// Invocata ogni minuto da pg_cron via pg_net, autenticata con x-cron-secret.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

Deno.serve(async (req: Request) => {
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

    const { data: cfgRows } = await admin.from('app_config').select('key, value')
    const cfg: Record<string, string> = Object.fromEntries(
      (cfgRows ?? []).map((r: { key: string; value: string }) => [r.key, r.value]),
    )

    const secret = req.headers.get('x-cron-secret')
    if (!cfg.cron_secret || secret !== cfg.cron_secret) {
      return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 })
    }

    webpush.setVapidDetails(
      cfg.vapid_subject || 'mailto:admin@fanta.local',
      cfg.vapid_public,
      cfg.vapid_private,
    )

    const { data: outbox } = await admin
      .from('push_outbox')
      .select('*')
      .eq('sent', false)
      .order('id', { ascending: true })
      .limit(300)

    let sent = 0
    for (const n of outbox ?? []) {
      const { data: subs } = await admin
        .from('push_subscriptions')
        .select('*')
        .eq('manager_id', n.manager_id)

      const payload = JSON.stringify({ title: n.title, body: n.body, url: n.url, tag: n.tag })

      for (const s of subs ?? []) {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
          )
          sent++
        } catch (e) {
          const status = (e as { statusCode?: number })?.statusCode
          if (status === 404 || status === 410) {
            // subscription scaduta/non valida -> rimuovi
            await admin.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
          }
        }
      }

      await admin
        .from('push_outbox')
        .update({ sent: true, sent_at: new Date().toISOString() })
        .eq('id', n.id)
    }

    return new Response(JSON.stringify({ processed: (outbox ?? []).length, sent }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
