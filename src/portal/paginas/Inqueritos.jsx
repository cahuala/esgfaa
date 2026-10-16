import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import { Aviso, Cartao, Carregando, Erro, Titulo, Vazio } from '../componentes'
import { data } from '../formatar'
import FormularioInquerito from '../inquerito/FormularioInquerito'
import { t as tx } from '../../i18n/linguas'

// inquéritos da Escola (satisfação com os serviços, o curso…): lista e resposta anónima
function Inqueritos() {
  const { id } = useParams()
  return id ? <Responder id={Number(id)} /> : <Lista />
}

function Lista() {
  const [l, setL] = useState(null)
  const [erro, setErro] = useState('')
  useEffect(() => { api('/inqueritos-escola').then(setL).catch((e) => setErro(e.message)) }, [])
  if (erro) return <Erro texto={erro} />
  if (!l) return <Carregando />
  const porResponder = l.filter((i) => !i.respondido)
  return (
    <>
      <Titulo rotulo={tx('Inquéritos')} titulo={tx('Inquéritos da Escola')} sub={tx('a sua opinião, de forma anónima')} />
      {l.length === 0 ? <Vazio>{tx('Não há inquéritos abertos para si.')}</Vazio> : (
        <Cartao titulo={<><i className="fa fa-poll me-2" />{tx('Abertos (')}{porResponder.length} {tx('por responder)')}</>} corpo={false}>
          <div className="list-group list-group-flush">
            {l.map((i) => (
              <Link key={i.id} to={`/inqueritos/${i.id}`} className="list-group-item list-group-item-action d-flex align-items-center gap-3">
                <span className={`p-atividade-icone ${i.respondido ? 'bg-success' : 'bg-cyan'}`}><i className={`fa ${i.respondido ? 'fa-check' : 'fa-poll'}`} /></span>
                <span className="flex-grow-1"><b className="d-block">{i.titulo}</b><span className="small text-muted">{i.perguntas} {tx('pergunta(s) · responder até')} {data(i.fecha)}</span></span>
                {i.respondido ? <span className="badge bg-success">{tx('Respondido')}</span> : <span className="badge bg-warning text-dark">{tx('Por responder')}</span>}
              </Link>
            ))}
          </div>
        </Cartao>
      )}
    </>
  )
}

function Responder({ id }) {
  const [i, setI] = useState(null)
  const [erro, setErro] = useState('')
  const [respostas, setRespostas] = useState({})
  const [aEnviar, setAEnviar] = useState(false)
  const [aviso, setAviso] = useState(null)
  const carregar = useCallback(() => api(`/inqueritos-escola/${id}`).then(setI).catch((e) => setErro(e.message)), [id])
  useEffect(() => { carregar() }, [carregar])
  if (erro) return <Erro texto={erro} />
  if (!i) return <Carregando />

  async function enviar() {
    setAEnviar(true)
    try {
      setI(await api(`/inqueritos-escola/${id}/respostas`, { metodo: 'POST', corpo: { respostas } }))
      setAviso({ texto: tx('Obrigado: a sua resposta foi registada de forma anónima.') })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (falha) {
      setAviso({ tipo: 'erro', texto: falha.message })
    } finally {
      setAEnviar(false)
    }
  }
  return (
    <>
      <Titulo rotulo={tx('Inquéritos')} titulo={tx('Inquéritos da Escola')} migalhas={[{ rotulo: tx('Inquéritos'), para: '/inqueritos' }, { rotulo: i.titulo }]} />
      <FormularioInquerito
        titulo={i.titulo}
        descricao={i.descricao}
        anonimo
        rodape={<div className="gf-notas pt-0 border-0 mt-2"><span><i className="fa fa-calendar-alt me-2" />{tx('responder até {0}', { 0: data(i.fecha) })}</span></div>}
        perguntas={i.perguntas}
        respostas={respostas}
        definir={(k, v) => setRespostas((r) => ({ ...r, [k]: v }))}
        limpar={() => setRespostas({})}
        aoEnviar={enviar}
        aEnviar={aEnviar}
        estado={i.respondido ? (
          <div className="gf-feito">
            <b><i className="fa fa-check-circle text-success me-2" />{tx('A sua resposta foi registada.')}</b>
            <span className="text-muted">{tx('Já respondeu a este inquérito. Obrigado.')}</span>
            <Link to="/inqueritos">{tx('Todos os inquéritos')}</Link>
          </div>
        ) : !i.podeResponder ? (
          <div className="gf-feito">
            <b><i className="fa fa-lock text-muted me-2" />{tx('Este inquérito já fechou.')}</b>
            <Link to="/inqueritos">{tx('Todos os inquéritos')}</Link>
          </div>
        ) : null}
      />
      <Aviso aviso={aviso} onFechar={() => setAviso(null)} />
    </>
  )
}

export default Inqueritos
