import { AVALIACAO, NOTA_MINIMA_APROVACAO, SITUACOES } from './regraAvaliacao'
import { nota } from './formatar'
import { t as tx } from '../i18n/linguas'

const BADGES = { cinzento: 'bg-gray-400', verde: 'bg-success', azul: 'bg-primary', dourado: 'bg-warning text-dark', vermelho: 'bg-danger' }

// motivo: porque reprovou com a média positiva (um TAI de teste escrito abaixo de 10, regra dos planos de curso)
export function Situacao({ situacao, motivo }) {
  const s = SITUACOES[situacao] || SITUACOES.em_curso
  const porTeste = situacao === 'reprovado' && motivo?.tipo === 'teste_escrito'
  return (
    <>
      <span className={`badge ${BADGES[s.cor]}`}>{s.texto}</span>
      {porTeste && (
        <small className="d-block text-danger mt-1" title={tx('Cada TAI de teste escrito tem de ter pelo menos 10, mesmo com a média positiva (plano do curso).')}>
          {tx('Teste escrito abaixo de 10: {0}', { 0: motivo.provas.map((p) => `${p.titulo} (${nota(p.nota)})`).join('; ') })}
        </small>
      )}
    </>
  )
}

// uma nota na matriz: negativa a vermelho, ≥ 14 a verde
export function Nota({ valor, forte }) {
  if (valor === null || valor === undefined) return <span className="p-nota-vazia">—</span>
  const n = Number(valor)
  const tom = n < NOTA_MINIMA_APROVACAO ? 'p-nota-negativa' : n >= AVALIACAO.macDispensa ? 'p-nota-alta' : ''
  return <span className={`p-valor ${tom} ${forte ? 'p-valor-forte' : ''}`}>{nota(n)}</span>
}
