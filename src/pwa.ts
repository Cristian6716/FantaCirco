import { registerSW } from 'virtual:pwa-register'

// Ogni quanto richiedere al browser di ricontrollare se esiste un sw.js nuovo.
const UPDATE_CHECK_INTERVAL = 60 * 1000

// Se due ricariche partono a meno di questo intervallo l'una dall'altra siamo
// in un loop (service worker che si reinstalla in continuazione): meglio
// fermarsi e lasciare l'app com'è piuttosto che ricaricare all'infinito.
const RELOAD_LOOP_WINDOW = 10 * 1000
const RELOAD_GUARD_KEY = 'fc:last-sw-reload'

function reloadOnce() {
  const last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) ?? 0)
  if (Date.now() - last < RELOAD_LOOP_WINDOW) return

  sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()))
  window.location.reload()
}

/**
 * Registra il service worker e tiene l'app aggiornata da sola.
 *
 * Senza questa registrazione "manuale" il plugin inietta uno script che si
 * limita a fare `navigator.serviceWorker.register()`: il service worker nuovo
 * si installa, ma la pagina aperta continua a girare sul codice vecchio finché
 * non viene ricaricata a mano. Su iOS la PWA installata viene sospesa e ripresa
 * senza mai ricaricarsi, quindi gli utenti restavano bloccati sulla versione
 * vecchia e l'unica via d'uscita sembrava reinstallare l'app.
 */
export function setupPwaUpdates() {
  registerSW({
    immediate: true,
    onNeedReload: reloadOnce,
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return

      const checkForUpdate = () => {
        if (!navigator.onLine) return
        void registration.update()
      }

      setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL)

      // Il controllo più importante su iOS: la app riprende dallo stato
      // sospeso senza ricaricare la pagina, quindi il ritorno in foreground è
      // spesso l'unico momento utile per accorgersi di una nuova versione.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') checkForUpdate()
      })
      window.addEventListener('online', checkForUpdate)
    },
  })
}
