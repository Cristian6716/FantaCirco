// Logica pronostici: calcolo risultati partita e punteggi.
// Portata da pronostici_fanta/lib/punteggi.ts, adattata al modello Supabase.

export type Esito1X2 = '1' | 'X' | '2'
export type EsitoOU = 'Si' | 'No'

/** Etichetta del secondo pronostico (multigol 1-2, sempre attivo). */
export function ouLabel(): string {
  return 'Multigol 1-2'
}

/** Le due opzioni disponibili per il secondo pronostico. */
export function ouOptions(): EsitoOU[] {
  return ['Si', 'No']
}

/** Risultato ufficiale di una partita a partire dai gol. */
export function calcolaRisultati(
  golCasa: number,
  golTrasferta: number,
): { risultato1X2: Esito1X2; risultatoOU: EsitoOU } {
  const risultato1X2: Esito1X2 =
    golCasa > golTrasferta ? '1' : golCasa === golTrasferta ? 'X' : '2'

  const totaleGol = golCasa + golTrasferta
  // Multigol 1-2: Si se il totale gol è 1 o 2, No altrimenti.
  const risultatoOU: EsitoOU = totaleGol >= 1 && totaleGol <= 2 ? 'Si' : 'No'

  return { risultato1X2, risultatoOU }
}

/** Punti di un singolo pronostico rispetto al risultato reale (null se non giocata). */
export function puntiPronostico(
  pron: { pronostico_1x2: string; pronostico_ou: string },
  golCasa: number | null,
  golTrasferta: number | null,
): { punti1X2: number; puntiOU: number } | null {
  if (golCasa === null || golTrasferta === null) return null
  const { risultato1X2, risultatoOU } = calcolaRisultati(golCasa, golTrasferta)
  return {
    punti1X2: pron.pronostico_1x2 === risultato1X2 ? 3 : 0,
    puntiOU: pron.pronostico_ou === risultatoOU ? 1 : 0,
  }
}
