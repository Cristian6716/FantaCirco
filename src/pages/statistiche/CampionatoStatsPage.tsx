import { useMemo } from 'react'
import { useAlboOro, useStatMatches, type AlboOroRow } from '../../lib/statisticheQueries'
import { calculateCampionatoRecords } from '../../lib/statisticheCalc'
import { EmptyState, PageLoader } from '../../components/ui'

function StatCard({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
    </div>
  )
}

function latestChampion(entries: AlboOroRow[], competizione: string): AlboOroRow | null {
  const filtered = entries.filter((e) => e.competizione === competizione)
  if (filtered.length === 0) return null
  return [...filtered].sort((a, b) => b.stagione.localeCompare(a.stagione, 'it'))[0]
}

function ChampionCard({ title, icon, entry, big }: { title: string; icon: string; entry: AlboOroRow | null; big?: boolean }) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl border text-center ${
        big ? 'border-accent-strong bg-surface-2 px-3 py-6' : 'border-border bg-surface px-2 py-4'
      }`}
    >
      <span className={big ? 'text-3xl' : 'text-xl'}>{icon}</span>
      <p className={`mt-1 font-semibold uppercase tracking-wide text-slate-400 ${big ? 'text-xs' : 'text-[10px]'}`}>{title}</p>
      {entry ? (
        <>
          <p className={`mt-1 max-w-full truncate font-bold text-white ${big ? 'text-base' : 'text-sm'}`}>{entry.squadra}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">{entry.stagione}</p>
        </>
      ) : (
        <p className="mt-1 text-xs text-slate-500">—</p>
      )}
    </div>
  )
}

export default function CampionatoStatsPage() {
  const matches = useStatMatches()
  const { data: alboOro, isLoading } = useAlboOro()

  const records = useMemo(() => calculateCampionatoRecords(matches), [matches])

  if (isLoading) return <PageLoader />

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-white">Statistiche campionato</h1>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-300">Albo d'oro</h2>
        {!alboOro || alboOro.length === 0 ? (
          <EmptyState icon="🏆" title="Nessun trofeo registrato" hint="L'admin può aggiungerli da Amministrazione" />
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <ChampionCard title="Coppa" icon="🥤" entry={latestChampion(alboOro, 'coppa')} />
            <ChampionCard title="Campionato" icon="🏆" entry={latestChampion(alboOro, 'campionato')} big />
            <ChampionCard title="Battle Royale" icon="⚔️" entry={latestChampion(alboOro, 'battle_royale')} />
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

            <StatCard label="Partita con meno punti totali" hint="Somma dei punti fantacalcio delle due squadre">
              {records.partitaMenoPunti ? (
                <>
                  <p className="text-sm font-medium text-white">
                    {records.partitaMenoPunti.match.casa} {records.partitaMenoPunti.puntiCasa}-
                    {records.partitaMenoPunti.puntiTrasferta} {records.partitaMenoPunti.match.trasferta}
                  </p>
                  <p className="text-xs text-slate-400">
                    {records.partitaMenoPunti.puntiTotali} punti · {records.partitaMenoPunti.match.stagione} · G
                    {records.partitaMenoPunti.match.giornata}
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

            <StatCard label="Più giornate da sola in testa in una stagione">
              {records.giornateInTestaMassimo ? (
                <>
                  <p className="text-sm font-medium text-white">{records.giornateInTestaMassimo.squadra}</p>
                  <p className="text-xs text-slate-400">
                    {records.giornateInTestaMassimo.giornateInTesta} giornate su{' '}
                    {records.giornateInTestaMassimo.giornateTotali} · {records.giornateInTestaMassimo.stagione}
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
