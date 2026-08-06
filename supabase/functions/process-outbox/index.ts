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

    const GIVE_UP_AFTER_MS = 24 * 60 * 60 * 1000 // dopo 24h di tentativi falliti, arrendersi

    let sent = 0
    for (const n of outbox ?? []) {
      const { data: subs } = await admin
        .from('push_subscriptions')
        .select('*')
        .eq('manager_id', n.manager_id)

      const payload = JSON.stringify({ title: n.title, body: n.body, url: n.url, tag: n.tag })

      let successCount = 0
      let lastError: string | null = null

      for (const s of subs ?? []) {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
          )
          successCount++
          sent++
        } catch (e) {
          const status = (e as { statusCode?: number })?.statusCode
          if (status === 404 || status === 410) {
            // subscription scaduta/non valida -> rimuovi
            await admin.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
          }
          lastError = `${status ?? 'ERR'}: ${e instanceof Error ? e.message : String(e)}`
        }
      }

      if (successCount > 0) {
        // consegnata ad almeno un dispositivo: chiusa con successo
        await admin
          .from('push_outbox')
          .update({ sent: true, sent_at: new Date().toISOString(), error: null })
          .eq('id', n.id)
      } else {
        // nessun dispositivo raggiunto (nessuna subscription o invii tutti falliti):
        // ritenta ai prossimi giri di cron, arrenditi solo dopo 24h per non accumulare righe in eterno
        const ageMs = Date.now() - new Date(n.created_at).getTime()
        const giveUp = ageMs > GIVE_UP_AFTER_MS
        await admin
          .from('push_outbox')
          .update({
            sent: giveUp,
            sent_at: giveUp ? new Date().toISOString() : null,
            error: lastError ?? (subs && subs.length === 0 ? 'no_subscriptions' : 'unknown'),
          })
          .eq('id', n.id)
      }
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
