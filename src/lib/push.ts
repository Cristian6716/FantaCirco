import { supabase } from './supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

export function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

export function pushConfigured(): boolean {
  return !!VAPID_PUBLIC_KEY
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.getSubscription()
}

export async function enablePush(managerId: string): Promise<void> {
  if (!isPushSupported()) throw new Error('Notifiche non supportate da questo browser')
  if (!VAPID_PUBLIC_KEY) throw new Error('Notifiche non ancora configurate (manca la chiave VAPID)')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Permesso notifiche negato')

  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    })
  }

  const json = sub.toJSON()
  const endpoint = sub.endpoint
  const p256dh = json.keys?.p256dh
  const auth = json.keys?.auth
  if (!p256dh || !auth) throw new Error('Subscription non valida')

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({ manager_id: managerId, endpoint, p256dh, auth }, { onConflict: 'endpoint' })
  if (error) throw new Error(error.message)
}

/**
 * Riallinea la subscription push a ogni apertura/ritorno in foreground dell'app.
 * Serve soprattutto su iOS, dove Safari puo' invalidare silenziosamente la
 * subscription (reinstall della PWA, cambi di sistema, inattivita' prolungata):
 * senza questo, l'utente restava "iscritto" solo lato UI ma non riceveva piu'
 * nulla finche' non riapriva manualmente Profilo e ripremeva il bottone.
 * Non richiede mai il permesso: agisce solo se e' gia' stato concesso.
 */
export async function resyncPush(managerId: string): Promise<void> {
  if (!isPushSupported() || !VAPID_PUBLIC_KEY) return
  if (Notification.permission !== 'granted') return
  try {
    const reg = await navigator.serviceWorker.ready
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      })
    }
    const json = sub.toJSON()
    const p256dh = json.keys?.p256dh
    const auth = json.keys?.auth
    if (!p256dh || !auth) return
    await supabase
      .from('push_subscriptions')
      .upsert({ manager_id: managerId, endpoint: sub.endpoint, p256dh, auth }, { onConflict: 'endpoint' })
  } catch {
    // best-effort: se la re-subscribe fallisce (es. permesso revocato nel frattempo) non blocchiamo l'app
  }
}

export async function disablePush(): Promise<void> {
  const sub = await currentSubscription()
  if (sub) {
    await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
    await sub.unsubscribe()
  }
}
