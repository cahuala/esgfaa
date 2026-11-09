import { useState } from 'react'
import { t as tx } from '../i18n/linguas'
import { regrasDoPlano } from './regrasDoPlano'
import './RegrasPlano.css'

/*
  As regras de avaliação do plano de curso, como o plano as escreve, para quem é avaliado e para quem avalia.
  Montam-se a partir do próprio plano (as mesmas regras que o sistema aplica): a nota de cada UC, os mínimos
  que o curso exige, a recuperação e a revisão, a nota dos blocos e a final (com os coeficientes), as faltas,
  o ajuste do Comandante, as menções e o Conselho de Curso. Só aparece o que se aplica ao curso.
  plano = { nome, termo, formula, blocos, ajusteMaximo, exigirBlocos, exigirTesteEscrito, exigirUcs, exigirTii,
            faltasMaximas, duracaoMeses, factoresJuizo, trabalho }
*/
// o quadro: fechado por defeito (com um resumo da nota final), abre-se para ver todas as regras
// abrirDocumento(id): abre o PDF do plano (no portal; sem ele, o botão não aparece)
export default function RegrasPlano({ plano, aberto = false, className = '', abrirDocumento }) {
  const [abrir, setAbrir] = useState(aberto)
  const [erro, setErro] = useState('')
  const regras = regrasDoPlano(plano)
  if (!regras.length) return null
  return (
    <section className={`p-regras-plano ${className}`} aria-label={tx('Regras de avaliação do curso')}>
      <button type="button" className="p-regras-cabeca" onClick={() => setAbrir(!abrir)} aria-expanded={abrir}>
        <i className="fa fa-balance-scale me-2" aria-hidden="true" />
        <span className="me-auto"><b>{tx('Regras de avaliação do curso')}</b>{plano.nome && <span className="d-block small text-muted">{plano.nome}</span>}</span>
        <i className={`fa fa-chevron-${abrir ? 'up' : 'down'}`} aria-hidden="true" />
      </button>
      {plano.ficheiroId && abrirDocumento && (
        <div className="px-3 py-2">
          <button type="button" className="btn btn-sm btn-white" onClick={() => abrirDocumento(plano.ficheiroId).catch((e) => setErro(e.message))}><i className="fa fa-file-pdf me-1" aria-hidden="true" />{tx('Abrir o plano do curso (PDF)')}</button>
          {erro && <span className="text-danger small ms-2">{erro}</span>}
        </div>
      )}
      {abrir && (
        <dl className="p-regras-lista mb-0">
          {regras.map(([titulo, texto]) => (
            <div key={titulo + texto.slice(0, 12)}>
              <dt>{titulo}</dt>
              <dd>{texto}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  )
}
