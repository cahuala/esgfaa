import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import { Aviso, Cartao, Carregando, Erro, Titulo, Vazio } from '../componentes'
import { data } from '../formatar'
import FormularioOpiniao from '../FormularioOpiniao'

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
      <Titulo rotulo="Inquéritos" titulo="Inquéritos da Escola" sub="a sua opinião, de forma anónima" />
      {l.length === 0 ? <Vazio>Não há inquéritos abertos para si.</Vazio> : (
        <Cartao titulo={<><i className="fa fa-poll me-2" />Abertos ({porResponder.length} por responder)</>} corpo={false}>
          <div className="list-group list-group-flush">
            {l.map((i) => (
              <Link key={i.id} to={`/inqueritos/${i.id}`} className="list-group-item list-group-item-action d-flex align-items-center gap-3">
                <span className={`p-atividade-icone ${i.respondido ? 'bg-success' : 'bg-cyan'}`}><i className={`fa ${i.respondido ? 'fa-check' : 'fa-poll'}`} /></span>
                <span className="flex-grow-1"><b className="d-block">{i.titulo}</b><span className="small text-muted">{i.perguntas} pergunta(s) · responder até {data(i.fecha)}</span></span>
                {i.respondido ? <span className="badge bg-success">Respondido</span> : <span className="badge bg-warning text-dark">Por responder</span>}
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

  async function enviar(e) {
    e.preventDefault()
    setAEnviar(true)
    try {
      setI(await api(`/inqueritos-escola/${id}/respostas`, { metodo: 'POST', corpo: { respostas } }))
      setAviso({ texto: 'Obrigado: a sua resposta foi registada de forma anónima.' })
    } catch (falha) {
      setAviso({ tipo: 'erro', texto: falha.message })
    } finally {
      setAEnviar(false)
    }
  }
  return (
    <>
      <Titulo rotulo="Inquéritos" titulo={i.titulo} sub={`responder até ${data(i.fecha)}`} migalhas={[{ rotulo: 'Inquéritos', para: '/inqueritos' }, { rotulo: i.titulo }]} />
      <Cartao titulo={<><i className="fa fa-user-secret me-2" />Respostas anónimas</>}>
        {i.descricao && <p className="text-muted">{i.descricao}</p>}
        {i.respondido ? <div className="alert alert-success mb-0"><i className="fa fa-check-circle me-1" />Já respondeu a este inquérito. Obrigado.</div>
          : !i.podeResponder ? <div className="alert alert-secondary mb-0">Este inquérito já fechou.</div> : (
            <form onSubmit={enviar} className="p-formulario">
              <FormularioOpiniao perguntas={i.perguntas} respostas={respostas} definir={(k, v) => setRespostas((r) => ({ ...r, [k]: v }))} numerar />
              <div><button type="submit" className="btn btn-theme" disabled={aEnviar}>{aEnviar ? 'A enviar…' : 'Enviar'}</button></div>
            </form>
          )}
      </Cartao>
      <Link to="/inqueritos" className="btn btn-white"><i className="fa fa-arrow-left me-1" />Todos os inquéritos</Link>
      <Aviso aviso={aviso} onFechar={() => setAviso(null)} />
    </>
  )
}

export default Inqueritos
