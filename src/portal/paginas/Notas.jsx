import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { Cartao, Carregando, Erro, Etiqueta, Titulo, Vazio } from '../componentes'
import { nota } from '../formatar'

// boletim: avaliações publicadas de cada cadeira, média ponderada e situação
function Notas() {
  const [lista, setLista] = useState(null)
  const [erro, setErro] = useState('')
  useEffect(() => { api('/notas').then(setLista).catch((e) => setErro(e.message)) }, [])

  return (
    <>
      <Titulo rotulo="Avaliação" titulo="Notas" />
      <p className="p-texto-suave p-mb">Só aparecem as avaliações já publicadas pelos docentes. A média é ponderada pelo peso de cada avaliação (escala de 0 a 20; aprovação a partir de 10).</p>
      {erro && <Erro texto={erro} />}
      {!lista && !erro ? <Carregando /> : lista && (lista.length === 0 ? <Vazio>Sem cadeiras.</Vazio> : (
        <div className="p-coluna">
          {lista.map((c) => (
            <Cartao key={c.cadeira.id} titulo={<Link to={`/cadeiras/${c.cadeira.id}`}>{c.cadeira.codigo} · {c.cadeira.nome}</Link>} acoes={<Situacao c={c} />}>
              {c.avaliacoes.length === 0 ? <Vazio>Sem notas publicadas.</Vazio> : (
                <div className="p-tabela-rolavel">
                  <table className="p-tabela">
                    <thead><tr><th>Avaliação</th><th className="p-num">Peso</th><th className="p-num">Nota</th></tr></thead>
                    <tbody>
                      {c.avaliacoes.map((a) => (
                        <tr key={a.id}><td>{a.nome}</td><td className="p-num">{a.peso} %</td><td className="p-num"><strong>{nota(a.nota)}</strong></td></tr>
                      ))}
                    </tbody>
                    <tfoot><tr><th colSpan={2}>Média {c.completa ? 'final' : 'até agora'}</th><th className="p-num">{nota(c.media)}</th></tr></tfoot>
                  </table>
                </div>
              )}
            </Cartao>
          ))}
        </div>
      ))}
    </>
  )
}

export function Situacao({ c }) {
  if (c.aprovado === true) return <Etiqueta cor="verde">Aprovado · {nota(c.media)}</Etiqueta>
  if (c.aprovado === false) return <Etiqueta cor="vermelho">Reprovado · {nota(c.media)}</Etiqueta>
  if (c.media !== null) return <Etiqueta cor="azul">Em curso · {nota(c.media)}</Etiqueta>
  return <Etiqueta>Sem notas</Etiqueta>
}

export default Notas
