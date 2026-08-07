# ⚽ Fanta Dinamica

App PWA per gestire l'**asta dinamica** del fantacalcio sugli svincolati: rilanci, auto-bid
(stile eBay), blocco crediti, fasi 24h+24h, ritiri, pannello admin, notifiche push e
condivisione su WhatsApp.

## Stack
- **Frontend**: Vite + React + TypeScript + Tailwind v4 (PWA con `vite-plugin-pwa`)
- **Backend**: Supabase (Postgres + Auth + Realtime + Edge Functions + pg_cron + pg_net)
- **Hosting consigliato**: Vercel (frontend) — il backend è già su Supabase

## Come funziona l'asta
- Chi avvia un'asta piazza l'**offerta di apertura** al prezzo base (default 1, editabile) e
  diventa il primo in testa.
- **Fase 1 (24h)**: tutti possono rilanciare. **Fase 2 (24h)**: solo chi ha partecipato alla fase 1.
- **Auto-bid**: imposti un tetto massimo; l'app rilancia per te di +1 quando vieni superato,
  fino al tetto (il tetto è segreto e si può solo aumentare).
- **Crediti disponibili** = totali − somma degli impegni sulle aste in corso. L'impegno su
  un'asta è il maggiore tra l'offerta con cui sei in testa e il tetto del tuo auto-bid attivo:
  anche l'auto-bid blocca i crediti, quindi non puoi impegnarti oltre quello che hai.
  Si sbloccano appena vieni superato (o rimuovi l'auto-bid).
- **Limite di rosa**: massimo 33 giocatori, contando quelli già vinti più gli impegni aperti
  (aste dove sei in testa o hai un auto-bid attivo). A rosa piena non puoi avviare aste,
  rilanciare o impostare auto-bid. Il limite è in `app_config.max_roster`.
- **Ritiro**: possibile solo se non sei in testa. Quando tutti tranne il leader si ritirano (in
  fase 2) l'asta si chiude e il giocatore va al leader.
- A fine asta i crediti del vincitore vengono scalati e il giocatore assegnato.

## Sviluppo locale
```bash
npm install
npm run dev            # http://localhost:5173
```
Le variabili pubbliche sono in `.env.production` (URL Supabase, chiave publishable, chiave VAPID
pubblica). Per lo sviluppo esiste lo stesso `.env.local`.

## Deploy su Vercel
**Opzione A — da GitHub (consigliata, CI/CD automatico):**
1. Crea un repo su GitHub e fai push di questo progetto.
2. Su [vercel.com](https://vercel.com) → *Add New Project* → importa il repo.
3. Framework: **Vite**. Build: `npm run build`. Output: `dist`. Le variabili sono già in
   `.env.production`, quindi **non serve configurare nulla**. Deploy.

**Opzione B — da CLI:**
```bash
npm i -g vercel
vercel        # primo run: login + setup progetto
vercel --prod # deploy in produzione
```

> Dopo il deploy non serve modificare Supabase: l'API accetta richieste da qualunque origine
> (la sicurezza è garantita da RLS) e il login è username+password.

## Amministrazione (riservato all'admin)
- **Fantallenatori**: crea gli account (username + password), assegna i crediti.
- **Giocatori**: importa gli svincolati (un giocatore per riga: `Nome, Squadra, Ruoli`;
  ruoli **Mantra** anche multipli, es. `Dd/Ds` o `M;C`). Modalità Mantra.
- **Aste**: metti in pausa / annulla / elimina singole aste o tutte (con conferma).

Primo accesso admin: utente **`cristian`**, password **`FantaAdmin2026`** (cambiala da *Profilo*).

## Notifiche push
- Attivabili da *Profilo → Notifiche push*. Arrivano quando vieni superato e a fine fase.
- **Android**: funzionano anche da browser, meglio se l'app è installata.
- **iPhone**: funzionano **solo** dopo aver aggiunto la PWA alla schermata Home (iOS 16.4+).

## Backend (Supabase)
- Migrazioni SQL in `supabase/migrations` (applicate al progetto cloud).
- Edge Functions in `supabase/functions`:
  - `admin-create-user`: crea gli account (bootstrap del primo admin, poi solo admin).
  - `process-outbox`: invia le notifiche push in coda (chiamata ogni minuto da pg_cron).
- Job pianificati (pg_cron): `fanta-tick` (avanzamento fasi/chiusure) e `fanta-push` (invio notifiche).

## Generare le icone
```bash
node scripts/gen-icons.mjs
```
