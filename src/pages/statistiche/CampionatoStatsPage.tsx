import { useMemo, useState } from 'react'
import { useAlboOro, useStatMatches } from '../../lib/statisticheQueries'
import { calculateAlboOroLeaderboard, calculateCampionatoRecords } from '../../lib/statisticheCalc'
import { EmptyState, PageLoader } from '../../components/ui'

const COMP_LABEL: Record<string, string> = {
  campionato: 'Campionato',
  coppa: 'Coppa',
  battle_royale: 'Battle Royale',
}

function StatCard({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
    </div>
  )
}

function AlboOroRow({ row }: { row: ReturnType<typeof calculateAlboOroLeaderboard>[number] }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl border border-border bg-surface">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
      >
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-white">{row.squadra}</span>
        <span className="flex shrink-0 items-center gap-1.5 text-xs text-slate-400">
          {row.campionato > 0 && <span className="rounded-full bg-surface-2 px-2 py-0.5">🏆 {row.campionato}</span>}
          {row.coppa > 0 && <span className="rounded-full bg-surface-2 px-2 py-0.5">🥤 {row.coppa}</span>}
          {row.battle_royale > 0 && <span className="rounded-full bg-surface-2 px-2 py-0.5">⚔️ {row.battle_royale}</span>}
          <span className="text-lg font-bold text-accent">{row.totale}</span>
        </span>
      </button>
      {open && (
        <div className="space-y-1 border-t border-border px-3 py-2">
          {row.trofei.map((t) => (
            <div key={t.id} className="flex items-center justify-between text-xs text-slate-300">
              <span>
                {t.stagione} · {COMP_LABEL[t.competizione]}
              </span>
              {t.note && <span className="text-slate-500">{t.note}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function CampionatoStatsPage() {
  const matches = useStatMatches()
  const { data: alboOro, isLoading } = useAlboOro()

  const records = useMemo(() => calculateCampionatoRecords(matches), [matches])
  const leaderboard = useMemo(() => calculateAlboOroLeaderboard(alboOro ?? []), [alboOro])

  if (isLoading) return <PageLoader />

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-white">Statistiche campionato</h1>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-300">Albo d'oro</h2>
        {leaderboard.length === 0 ? (
          <EmptyState icon="🏆" title="Nessun trofeo registrato" hint="L'admin può aggiungerli da Amministrazione" />
        ) : (
          <div className="space-y-1.5">
            {leaderboard.map((row) => (
              <AlboOroRow key={row.squadra} row={row} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-300">Record</h2>
        {matches.filter((m) => m.competizione === 'campionato').length === 0 ? (
          <EmptyState icon="📊" title="Nessuna partita di campionato registrata" />
        ) : (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <StatCard label="Partita con più gol">
              {records.partitaPiuGol ? (
                <>
                  <p className="text-sm font-medium text-white">
                    {records.partitaPiuGol.match.casa} {records.partitaPiuGol.match.golCasa}-
                    {records.partitaPiuGol.match.golTrasferta} {records.partitaPiuGol.match.trasferta}
                  </p>
                  <p className="text-xs text-slate-400">
                    {records.partitaPiuGol.golTotali} gol · {records.partitaPiuGol.match.stagione} · G
                    {records.partitaPiuGol.match.giornata}
                  </p>
                </>
              ) : (
                <p className="text-sm text-slate-500">—</p>
              )}
            </StatCard>

            <StatCard label="Partita con meno gol totali">
              {records.partitaMenoGol ? (
                <>
                  <p className="text-sm font-medium text-white">
                    {records.partitaMenoGol.match.casa} {records.partitaMenoGol.match.golCasa}-
                    {records.partitaMenoGol.match.golTrasferta} {records.partitaMenoGol.match.trasferta}
                  </p>
                  <p className="text-xs text-slate-400">
                    {records.partitaMenoGol.golTotali} gol · {records.partitaMenoGol.match.stagione} · G
                    {records.partitaMenoGol.match.giornata}
                  </p>
                </>
              ) : (
                <p className="text-sm text-slate-500">—</p>
              )}
            </StatCard>

            <StatCard label="Campionato vinto col margine più ampio">
              {records.margineMassimo ? (
                <>
                  <p className="text-sm font-medium text-white">{records.margineMassimo.squadra}</p>
                  <p className="text-xs text-slate-400">
                    +{records.margineMassimo.margine} punti sul 2° ({records.margineMassimo.puntiPrimo}-
                    {records.margineMassimo.puntiSecondo}) · {records.margineMassimo.stagione}
                  </p>
                </>
              ) : (
                <p className="text-sm text-slate-500">—</p>
              )}
            </StatCard>

            <StatCard
              label="Campionato vinto con più anticipo"
              hint="Giornate finali passate ininterrottamente da sola in testa"
            >
              {records.anticipoMassimo ? (
                <>
                  <p className="text-sm font-medium text-white">{records.anticipoMassimo.squadra}</p>
                  <p className="text-xs text-slate-400">
                    {records.anticipoMassimo.giornateAnticipo} giornate d'anticipo · {records.anticipoMassimo.stagione}
                  </p>
                </>
              ) : (
                <p className="text-sm text-slate-500">—</p>
              )}
            </StatCard>

            <StatCard label="Striscia di imbattibilità più lunga">
              {records.strisceImbattibilita.length > 0 ? (
                <div className="space-y-1">
                  {records.strisceImbattibilita.map((s) => (
                    <div key={`${s.stagione}-${s.squadra}`}>
                      <p className="text-sm font-medium text-white">{s.squadra}</p>
                      <p className="text-xs text-slate-400">
                        {s.lunghezza} partite (G{s.giornataInizio}-G{s.giornataFine}) · {s.stagione}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">—</p>
              )}
            </StatCard>

            <StatCard label="Striscia di vittorie più lunga">
              {records.strischeVittorie.length > 0 ? (
                <div className="space-y-1">
                  {records.strischeVittorie.map((s) => (
                    <div key={`${s.stagione}-${s.squadra}`}>
                      <p className="text-sm font-medium text-white">{s.squadra}</p>
                      <p className="text-xs text-slate-400">
                        {s.lunghezza} vittorie (G{s.giornataInizio}-G{s.giornataFine}) · {s.stagione}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">—</p>
              )}
            </StatCard>

            <StatCard label="Striscia di sconfitte più lunga">
              {records.strischeSconfitte.length > 0 ? (
                <div className="space-y-1">
                  {records.strischeSconfitte.map((s) => (
                    <div key={`${s.stagione}-${s.squadra}`}>
                      <p className="text-sm font-medium text-white">{s.squadra}</p>
                      <p className="text-xs text-slate-400">
                        {s.lunghezza} sconfitte (G{s.giornataInizio}-G{s.giornataFine}) · {s.stagione}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">—</p>
              )}
            </StatCard>
          </div>
        )}
      </section>
    </div>
  )
}
