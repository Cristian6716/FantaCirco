import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      // La registrazione la facciamo a mano in src/pwa.ts: lo script iniettato
      // dal plugin registra il service worker ma non ricarica mai la pagina
      // quando arriva una versione nuova.
      injectRegister: null,
      manifest: {
        name: 'FantaCirco',
        short_name: 'FantaCirco',
        description: "Asta dinamica del fantacalcio: rilanci, auto-bid, crediti e notifiche.",
        lang: 'it',
        theme_color: '#0b1120',
        background_color: '#0b1120',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
      },
      devOptions: {
        // Service worker disattivato in dev (evita interferenze con HMR e con il
        // browser headless dell'anteprima). In produzione la PWA resta attiva.
        enabled: false,
        type: 'module',
        navigateFallback: 'index.html',
      },
    }),
  ],
})
