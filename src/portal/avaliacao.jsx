import { AVALIACAO, NOTA_MINIMA_APROVACAO, SITUACOES } from './regraAvaliacao'
import { nota } from './formatar'

const BADGES = { cinzento: 'bg-gray-400', verde: 'bg-success', azul: 'bg-primary', dourado: 'bg-warning text-dark', vermelho: 'bg-danger' }

export function Situacao({ situacao }) {
  const s = SITUACOES[situacao] || SITUACOES.em_curso
  return <span className={`badge ${BADGES[s.cor]}`}>{s.texto}</span>
}

// uma nota na matriz: negativa a vermelho, ≥ 14 a verde
export function Nota({ valor, forte }) {
  if (valor === null || valor === undefined) return <span className="p-nota-vazia">—</span>
  const n = Number(valor)
  const tom = n < NOTA_MINIMA_APROVACAO ? 'p-nota-negativa' : n >= AVALIACAO.macDispensa ? 'p-nota-alta' : ''
  return <span className={`p-valor ${tom} ${forte ? 'p-valor-forte' : ''}`}>{nota(n)}</span>
}
