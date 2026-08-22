import { PodioFinale } from './pronostici/PodioPage'
import type { PodioClassificaRow } from '../lib/podio'

// Voti reali del round in corso (12 votanti), per vedere il podio com'è ora.
const reali: PodioClassificaRow[] = [
  { managerId: '1', nome: 'Sesko e Sambia', punti: 18, c1: 4, c2: 2, c3: 2, cu: 0 },
  { managerId: '2', nome: 'Figli di Putin', punti: 13, c1: 2, c2: 2, c3: 3, cu: 0 },
  { managerId: '3', nome: 'Fc Padre Tempo', punti: 11, c1: 2, c2: 2, c3: 1, cu: 0 },
  { managerId: '4', nome: 'Rubin Kebab', punti: 10, c1: 1, c2: 2, c3: 3, cu: 0 },
  { managerId: '5', nome: 'Fessa Kyoto Fc', punti: 9, c1: 3, c2: 0, c3: 0, cu: 1 },
  { managerId: '6', nome: 'Cani della Malesia', punti: 3, c1: 0, c2: 1, c3: 1, cu: 4 },
]

// Caso peggiore per i nomi lunghi.
const lunghi: PodioClassificaRow[] = [
  { managerId: '7', nome: 'PASSAMO ALLE COSE FORMALI', punti: 18, c1: 4, c2: 2, c3: 2, cu: 0 },
  { managerId: '8', nome: 'Cani della Malesia', punti: 13, c1: 2, c2: 2, c3: 3, cu: 2 },
  { managerId: '9', nome: 'SAO SALVADOR', punti: 11, c1: 2, c2: 2, c3: 1, cu: 0 },
]

export default function PodioPreview() {
  return (
    <div id="anteprima" className="mx-auto max-w-md space-y-4 p-4">
      <PodioFinale rows={reali} />
      <PodioFinale rows={lunghi} />
    </div>
  )
}
