import { PageLoader } from '../../components/ui'
import { useAuth } from '../../auth/AuthProvider'
import { useClassificaPronostici } from './useClassificaPronostici'

export default function ClassificaPage() {
  const { rows, ultimaGiornata } = useClassificaPronostici()
  const { manager } = useAuth()

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-white">Classifica</h1>
      {rows.length === 0 ? (
        <PageLoader />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-2 text-xs uppercase tracking-wide text-slate-400">
                <th className="px-2 py-2 text-left font-medium">#</th>
                <th className="px-2 py-2 text-left font-medium">Squadra</th>
                <th className="px-2 py-2 text-center font-medium">1X2</th>
                <th className="px-2 py-2 text-center font-medium">Multigol</th>
                <th className="px-2 py-2 text-right font-medium">
                  Punti{ultimaGiornata !== null && ` (G${ultimaGiornata})`}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={r.managerId}
                  className={`border-t border-border ${r.managerId === manager?.id ? 'bg-accent/10' : 'bg-surface'}`}
                >
                  <td className="px-2 py-2 text-slate-400">{i + 1}</td>
                  <td className="px-2 py-2 font-medium text-white">{r.nome}</td>
                  <td className="px-2 py-2 text-center text-slate-300">{r.azzeccati1X2}</td>
                  <td className="px-2 py-2 text-center text-slate-300">{r.azzeccatiOU}</td>
                  <td className="px-2 py-2 text-right font-bold text-accent">
                    {r.punti}
                    {ultimaGiornata !== null && (
                      <span className="ml-1 text-xs font-medium text-slate-400">
                        (+{r.puntiUltima})
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
