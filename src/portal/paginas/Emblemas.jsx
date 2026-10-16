import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { Carregando, Erro, Titulo, Vazio } from '../componentes'
import { t as tx } from '../../i18n/linguas'

const ICONES_EMBLEMA = { inicio: 'fa-shoe-prints', capitulo: 'fa-bookmark', cadeira: 'fa-medal', pontual: 'fa-stopwatch' }
const NOMES = { inicio: tx('Primeiros passos'), capitulo: tx('Capítulo concluído'), cadeira: tx('Cadeira concluída'), pontual: tx('Sempre a tempo') }

export function Emblema({ e, pequeno }) {
  return (
    <div className={`p-emblema p-emblema-${e.tipo} ${e.ganho ? 'ganho' : ''} ${pequeno ? 'pequeno' : ''}`} title={`${e.titulo} — ${e.descricao}`}>
      <span className="p-emblema-medalha"><i className={`fa ${ICONES_EMBLEMA[e.tipo]}`} /></span>
      {!pequeno && (
        <div className="p-emblema-texto">
          <span className="p-emblema-tipo">{NOMES[e.tipo]}</span>
          <b>{e.tipo === 'inicio' || e.tipo === 'pontual' ? e.cadeira.nome : e.titulo}</b>
          {e.ganho ? <small>{e.descricao}</small>
            : e.perdido ? <small>{tx('Já não é possível: houve uma entrega fora do prazo.')}</small>
              : <><div className="p-emblema-barra"><span style={{ width: `${(e.feitas / e.total) * 100}%` }} /></div><small>{tx('{0} de {1}', { 0: e.feitas, 1: e.total })}</small></>}
        </div>
      )}
    </div>
  )
}

// os emblemas do estudante: os ganhos e os que estão por ganhar, com o que falta
function Emblemas() {
  const [d, setD] = useState(null)
  const [erro, setErro] = useState('')
  useEffect(() => { api('/emblemas').then(setD).catch((e) => setErro(e.message)) }, [])
  if (erro) return <Erro texto={erro} />
  if (!d) return <Carregando />
  const porGanhar = d.porGanhar.filter((e) => !e.perdido).sort((a, b) => b.feitas / b.total - a.feitas / a.total)
  return (
    <>
      <Titulo rotulo={tx('Emblemas')} titulo={tx('Os meus emblemas')} sub={tx('{0} ganho(s)', { 0: d.ganhos.length })} />
      <p className="text-muted">{tx('Os emblemas ganham-se sozinhos, ao avançar nas cadeiras: a primeira atividade, cada capítulo concluído, a cadeira inteira e os trabalhos todos entregues a tempo.')}</p>
      <h2 className="h5 fw-bold mt-3 mb-2"><i className="fa fa-trophy text-warning me-2" />{tx('Ganhos')}</h2>
      {d.ganhos.length === 0 ? <Vazio>{tx('Ainda não tem emblemas. Abra uma cadeira e faça a primeira atividade.')}</Vazio> : (
        <div className="p-emblemas">{d.ganhos.map((e) => <Emblema key={e.id} e={e} />)}</div>
      )}
      {porGanhar.length > 0 && (
        <>
          <h2 className="h5 fw-bold mt-4 mb-2"><i className="fa fa-flag-checkered text-muted me-2" />{tx('Por ganhar')}</h2>
          <div className="p-emblemas">{porGanhar.map((e) => <Link key={e.id} to={`/cadeiras/${e.cadeira.id}`} className="text-reset text-decoration-none"><Emblema e={e} /></Link>)}</div>
        </>
      )}
    </>
  )
}

export default Emblemas
