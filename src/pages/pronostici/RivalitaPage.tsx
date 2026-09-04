import { useMemo, useState } from 'react'
import { usePartite, useOraCorrente } from '../../lib/leagueQueries'
import {
  campionatoFinito,
  rivalitaChiuse,
  standingsPerGiornata,
  statoRivalita,
  useMyRivalitaVotes,
  useRivalita,
  useRivalitaConfig,
  useRivalitaRiepilogo,
  useSubmitRivalitaVote,
  type Rivalita,
  type RivalitaAndamento,
  type RivalitaStato,
} from '../../lib/rivalita'
import { TEAM_NAMES } from '../../lib/teams'
import { useStatMatches } from '../../lib/statisticheQueries'
import { calculateH2HBetween, type H2HMatchDetail } from '../../lib/statisticheCalc'
import { countdown, formatDateTime } from '../../lib/format'
import { EmptyState, PageLoader } from '../../components/ui'
import { useToast } from '../../components/Toast'
import { useAuth } from '../../auth/AuthProvider'

export default function RivalitaPage() {
  const { data: rivalita, isLoading } = useRivalita()
  const { data: config } = useRivalitaConfig()
  const { data: partite } = usePartite()
  const { data: myVotes } = useMyRivalitaVotes()
  const { data: riepilogo } = useRivalitaRiepilogo()

  // Alla deadline la pagina passa da sola in sola lettura, senza ricaricare.
  const ora = useOraCorrente(config?.chiusura_at)
  const chiuse = rivalitaChiuse(config, ora)

  const standings = useMemo(
    () => (partite ? standingsPerGiornata(partite, [...TEAM_NAMES]) : []),
    [partite],
  )
  const finito = useMemo(() => (partite ? campionatoFinito(partite) : false), [partite])

  // Elenco unificato (campionato, storico, svizzero, gironi, coppa): risolto una
  // volta qui e passato alle card, così ogni duello non lo ricostruisce da capo.
  const statMatches = useStatMatches()

  if (isLoading || !partite) return <PageLoader />

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-white">Rivalità</h1>
        <p className="mt-0.5 text-xs text-slate-400">
          Duelli da tutta la stagione: pronostica chi delle due chiuderà più in alto in campionato.
          Vince chi sta davanti alla 38ª giornata.
        </p>
      </div>

      {!chiuse && config?.chiusura_at && (
        <p className="rounded-lg border border-accent-strong/40 bg-accent-strong/10 px-3 py-2 text-xs text-slate-200">
          ⏳ I pronostici si chiudono il {formatDateTime(config.chiusura_at)} — manca{' '}
          <span className="font-semibold tabular-nums">{countdown(config.chiusura_at, ora)}</span>.
        </p>
      )}
      {chiuse && (
        <p className="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-slate-400">
          🔒 Pronostici chiusi. Ora si guarda solo la classifica.
        </p>
      )}

      {!rivalita || rivalita.length === 0 ? (
        <EmptyState
          icon="⚔️"
          title="Nessuna rivalità impostata"
          hint="Quando l'admin aggiunge i duelli della stagione li trovi qui."
        />
      ) : (
        <div className="space-y-3">
          {rivalita.map((r) => (
            <RivalitaCard
              key={r.id}
              rivalita={r}
              stato={statoRivalita(standings, r.team_a, r.team_b)}
              scelta={myVotes?.find((v) => v.rivalita_id === r.id)?.scelta ?? null}
              voti={riepilogo?.find((x) => x.rivalitaId === r.id) ?? null}
              chiuse={chiuse}
              finito={finito}
              precedenti={calculateH2HBetween(statMatches, r.team_a, r.team_b)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function RivalitaCard({
  rivalita,
  stato,
  scelta,
  voti,
  chiuse,
  finito,
  precedenti,
}: {
  rivalita: Rivalita
  stato: RivalitaStato
  scelta: string | null
  voti: { votiA: number; votiB: number } | null
  chiuse: boolean
  finito: boolean
  precedenti: H2HMatchDetail[]
}) {
  const { manager } = useAuth()
  const toast = useToast()
  const submit = useSubmitRivalitaVote()
  const [apriAndamento, setApriAndamento] = useState(false)
  const [apriPrecedenti, setApriPrecedenti] = useState(false)

  const mioTeam = manager?.team_name || manager?.display_name
  const coinvolto = mioTeam === rivalita.team_a || mioTeam === rivalita.team_b

  async function vota(team: string) {
    try {
      await submit.mutateAsync({ rivalita_id: rivalita.id, scelta: team })
      toast.success(`Pronostico salvato: ${team}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-surface-2 px-3 py-2">
        <p className="truncate text-sm font-bold text-white">⚔️ {rivalita.soprannome}</p>
        {coinvolto && (
          <span className="shrink-0 rounded-md bg-accent/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
            Ci sei tu
          </span>
        )}
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-2 p-3">
        <LatoSquadra
          team={rivalita.team_a}
          pos={stato.posA}
          pts={stato.ptsA}
          leader={stato.leader === rivalita.team_a}
          finito={finito}
          scelto={scelta === rivalita.team_a}
        />
        <div className="flex flex-col items-center justify-center px-1">
          <span className="text-xs font-black text-slate-500">VS</span>
          {stato.distacco != null && (
            <span className="mt-1 text-[10px] text-slate-500">
              {stato.distacco === 0 ? 'pari' : `${stato.distacco} pos.`}
            </span>
          )}
        </div>
        <LatoSquadra
          team={rivalita.team_b}
          pos={stato.posB}
          pts={stato.ptsB}
          leader={stato.leader === rivalita.team_b}
          finito={finito}
          scelto={scelta === rivalita.team_b}
        />
      </div>

      <div className="space-y-2 px-3 pb-3">
        {!chiuse ? (
          <>
            <p className="text-[11px] text-slate-400">
              {scelta ? 'Il tuo pronostico (modificabile fino alla chiusura):' : 'Chi arriva davanti?'}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {[rivalita.team_a, rivalita.team_b].map((team) => (
                <button
                  key={team}
                  onClick={() => void vota(team)}
                  disabled={submit.isPending}
                  className={[
                    'rounded-xl border px-2 py-2 text-xs font-semibold leading-tight transition-colors disabled:opacity-50',
                    scelta === team
                      ? 'border-accent/60 bg-accent/15 text-accent'
                      : 'border-border bg-surface-2 text-slate-300 active:scale-[0.98]',
                  ].join(' ')}
                >
                  {team}
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="text-[11px] text-slate-400">
            {scelta ? (
              <>
                Il tuo pronostico: <span className="font-semibold text-white">{scelta}</span>
              </>
            ) : (
              'Non hai pronosticato questo duello.'
            )}
          </p>
        )}

        {voti && <BarraVoti team_a={rivalita.team_a} team_b={rivalita.team_b} voti={voti} />}

        <button
          onClick={() => setApriAndamento((v) => !v)}
          className="flex w-full items-center justify-between rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-slate-300"
        >
          <span>Andamento giornata per giornata</span>
          <span className={`transition-transform ${apriAndamento ? 'rotate-180' : ''}`}>▾</span>
        </button>
        {apriAndamento && (
          <Andamento
            andamento={stato.andamento}
            team_a={rivalita.team_a}
            team_b={rivalita.team_b}
          />
        )}

        <button
          onClick={() => setApriPrecedenti((v) => !v)}
          className="flex w-full items-center justify-between rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-slate-300"
        >
          <span>
            Scontri diretti
            {precedenti.length > 0 && (
              <span className="ml-1.5 text-slate-500">({precedenti.length})</span>
            )}
          </span>
          <span className={`transition-transform ${apriPrecedenti ? 'rotate-180' : ''}`}>▾</span>
        </button>
        {apriPrecedenti && <Precedenti precedenti={precedenti} teamA={rivalita.team_a} />}
      </div>
    </div>
  )
}

const COMP_LABEL: Record<string, string> = {
  campionato: 'Camp.',
  svizzero: 'Svizzero',
  girone: 'Girone',
  coppa: 'Coppa',
}

/**
 * Precedenti fra le due rivali in tutte le competizioni (campionato, storico e
 * torneo). Non incidono su chi vince il duello — quello resta la posizione
 * finale in campionato — ma dicono chi ha avuto la meglio sul campo.
 */
function Precedenti({ precedenti, teamA }: { precedenti: H2HMatchDetail[]; teamA: string }) {
  if (precedenti.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-[11px] text-slate-400">
        Non si sono ancora affrontate.
      </p>
    )
  }

  const vinteA = precedenti.filter((m) => m.esito === 'V').length
  const pari = precedenti.filter((m) => m.esito === 'N').length
  const vinteB = precedenti.filter((m) => m.esito === 'P').length

  return (
    <div className="space-y-1.5 rounded-lg border border-border bg-surface-2 p-2.5">
      <p className="text-[11px] text-slate-400">
        <span className="font-semibold text-white">{vinteA}</span> vittorie {teamA} ·{' '}
        <span className="font-semibold text-white">{pari}</span> pari ·{' '}
        <span className="font-semibold text-white">{vinteB}</span> dell&apos;altra
      </p>
      <div className="space-y-1">
        {precedenti.map((m, i) => (
          <div
            key={`${m.stagione}-${m.competizione}-${m.giornata}-${i}`}
            className="flex items-center justify-between gap-2 text-[11px]"
          >
            <span className="truncate text-slate-500">
              {COMP_LABEL[m.competizione] ?? m.competizione} · {m.stagione} · G{m.giornata}
            </span>
            <span
              className={[
                'shrink-0 font-semibold',
                m.esito === 'V' ? 'text-emerald-300' : m.esito === 'P' ? 'text-rose-300' : 'text-slate-300',
              ].join(' ')}
            >
              {m.gf}-{m.gs}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function LatoSquadra({
  team,
  pos,
  pts,
  leader,
  finito,
  scelto,
}: {
  team: string
  pos: number | null
  pts: number | null
  leader: boolean
  finito: boolean
  scelto: boolean
}) {
  return (
    <div
      className={[
        'flex flex-col items-center justify-center rounded-xl border px-2 py-3 text-center',
        leader ? 'border-accent/50 bg-accent/10' : 'border-border bg-surface-2',
      ].join(' ')}
    >
      <p className="line-clamp-2 text-xs font-semibold leading-tight text-white">{team}</p>
      {pos == null ? (
        <p className="mt-1.5 text-[10px] text-slate-500">campionato non iniziato</p>
      ) : (
        <p className="mt-1.5 text-[11px] text-slate-400">
          <span className={`text-base font-black ${leader ? 'text-accent' : 'text-slate-200'}`}>
            {pos}°
          </span>{' '}
          · {pts} pt
        </p>
      )}
      <p className="mt-1 h-4 text-xs leading-none">
        {/* Lo stemmino va al vincitore solo a campionato finito; prima è solo chi conduce. */}
        {leader && (finito ? '🏅' : '👑')}
        {scelto && <span className="ml-1 text-[10px] text-accent">il tuo</span>}
      </p>
    </div>
  )
}

// Quanti hanno pronosticato l'una e quanti l'altra: si sblocca dopo aver
// pronosticato questo duello (o a pronostici chiusi).
function BarraVoti({
  team_a,
  team_b,
  voti,
}: {
  team_a: string
  team_b: string
  voti: { votiA: number; votiB: number }
}) {
  const tot = voti.votiA + voti.votiB
  if (tot === 0) return <p className="text-[11px] text-slate-500">Nessun pronostico ancora.</p>
  const pctA = Math.round((voti.votiA / tot) * 100)
  return (
    <div>
      <div className="flex h-2 overflow-hidden rounded-full bg-surface-2">
        <div className="bg-accent" style={{ width: `${pctA}%` }} />
        <div className="flex-1 bg-amber-400/70" />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-slate-400">
        <span className="truncate">
          {voti.votiA} · {team_a}
        </span>
        <span className="truncate text-right">
          {team_b} · {voti.votiB}
        </span>
      </div>
    </div>
  )
}

// ---------------- Andamento ----------------

const COLORE_A = '#22c55e'
const COLORE_B = '#f59e0b'

function Andamento({
  andamento,
  team_a,
  team_b,
}: {
  andamento: RivalitaAndamento[]
  team_a: string
  team_b: string
}) {
  if (andamento.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-surface-2 px-3 py-4 text-center text-xs text-slate-500">
        Nessuna giornata giocata: il duello parte con la prima.
      </p>
    )
  }

  return (
    <div className="space-y-2 rounded-lg border border-border bg-surface-2 p-3">
      <div className="flex flex-wrap gap-3 text-[10px] text-slate-400">
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-4 rounded-full" style={{ background: COLORE_A }} /> {team_a}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-4 rounded-full" style={{ background: COLORE_B }} /> {team_b}
        </span>
      </div>

      <GraficoPosizioni andamento={andamento} />

      <div className="max-h-56 overflow-y-auto overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[18rem] text-xs">
          <thead className="sticky top-0">
            <tr className="bg-surface text-[10px] uppercase tracking-wide text-slate-400">
              <th className="px-2 py-1.5 text-left font-medium">G</th>
              <th className="px-2 py-1.5 text-center font-medium">{team_a}</th>
              <th className="px-2 py-1.5 text-center font-medium">{team_b}</th>
              <th className="px-2 py-1.5 text-right font-medium">Davanti</th>
            </tr>
          </thead>
          <tbody>
            {[...andamento].reverse().map((a) => (
              <tr key={a.giornata} className="border-t border-border bg-surface-2">
                <td className="px-2 py-1.5 text-slate-400">{a.giornata}</td>
                <td className="px-2 py-1.5 text-center text-slate-200">
                  {a.posA}° <span className="text-slate-500">({a.ptsA})</span>
                </td>
                <td className="px-2 py-1.5 text-center text-slate-200">
                  {a.posB}° <span className="text-slate-500">({a.ptsB})</span>
                </td>
                <td
                  className="truncate px-2 py-1.5 text-right font-semibold"
                  style={{ color: a.posA < a.posB ? COLORE_A : COLORE_B }}
                >
                  {a.posA < a.posB ? team_a : team_b}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/**
 * Posizione in classifica giornata per giornata. L'asse Y è rovesciato: 1°
 * in alto, 16° in basso, come si legge una classifica.
 */
function GraficoPosizioni({ andamento }: { andamento: RivalitaAndamento[] }) {
  const W = 320
  const H = 120
  const PAD_X = 18
  const PAD_Y = 10
  const squadre = TEAM_NAMES.length

  const x = (i: number) =>
    andamento.length === 1
      ? W / 2
      : PAD_X + (i * (W - PAD_X * 2)) / (andamento.length - 1)
  const y = (pos: number) => PAD_Y + ((pos - 1) * (H - PAD_Y * 2)) / (squadre - 1)

  const path = (get: (a: RivalitaAndamento) => number) =>
    andamento.map((a, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(get(a))}`).join(' ')

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label="Posizione in classifica giornata per giornata"
    >
      {[1, 8, squadre].map((pos) => (
        <g key={pos}>
          <line
            x1={PAD_X}
            x2={W - PAD_X}
            y1={y(pos)}
            y2={y(pos)}
            stroke="#273249"
            strokeWidth="1"
          />
          <text x={2} y={y(pos) + 3} fill="#64748b" fontSize="8">
            {pos}°
          </text>
        </g>
      ))}
      <path d={path((a) => a.posA)} fill="none" stroke={COLORE_A} strokeWidth="2" />
      <path d={path((a) => a.posB)} fill="none" stroke={COLORE_B} strokeWidth="2" />
      {andamento.length === 1 && (
        <>
          <circle cx={x(0)} cy={y(andamento[0].posA)} r="3" fill={COLORE_A} />
          <circle cx={x(0)} cy={y(andamento[0].posB)} r="3" fill={COLORE_B} />
        </>
      )}
    </svg>
  )
}
