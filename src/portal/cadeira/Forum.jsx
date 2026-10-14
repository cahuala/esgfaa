import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { useSessao } from '../sessaoContexto'
import { Campo, Cartao, Carregando, Vazio } from '../componentes'
import { dataHora, iniciais } from '../formatar'

// fórum da cadeira (como o do Moodle): tópicos, respostas e moderação pelo docente
function Forum({ c, eDocente, avisar }) {
  const [lista, setLista] = useState(null)
  const [aberto, setAberto] = useState(null)
  const falhou = useCallback((e) => avisar({ tipo: 'erro', texto: e.message }), [avisar])
  const carregar = useCallback(() => api(`/cadeiras/${c.id}/forum`).then(setLista).catch(falhou), [c.id, falhou])
  useEffect(() => { carregar() }, [carregar])

  if (aberto) return <Topico id={aberto} eDocente={eDocente} avisar={avisar} voltar={() => { setAberto(null); carregar() }} />
  if (!lista) return <Carregando />

  return (
    <div className="p-grelha-lado">
      <Cartao titulo={<><i className="fa fa-comments me-2" />Fórum da cadeira</>} corpo={false}>
        {lista.length === 0 ? <div className="panel-body"><Vazio>Ainda não há tópicos. Comece a conversa.</Vazio></div> : (
          <div className="list-group list-group-flush">
            {lista.map((t) => (
              <button key={t.id} type="button" className="list-group-item list-group-item-action d-flex gap-3 align-items-start text-start" onClick={() => setAberto(t.id)}>
                <span className="admin-avatar flex-shrink-0">{iniciais(t.autor.nome)}</span>
                <span className="flex-grow-1 min-w-0">
                  <span className="d-block fw-bold">
                    {t.fixado && <i className="fa fa-thumbtack text-danger me-1" title="Fixado" />}
                    {t.fechado && <i className="fa fa-lock text-muted me-1" title="Fechado" />}
                    {t.titulo}
                  </span>
                  <span className="d-block small text-muted">{t.autor.nome}{t.autor.tipo === 'docente' && ' (docente)'} · {dataHora(t.criadoEm)}</span>
                  <span className="d-block small p-recorte">{t.texto}</span>
                </span>
                <span className="text-center flex-shrink-0">
                  <span className="d-block fs-16px fw-bold">{t.respostas}</span>
                  <span className="small text-muted">respostas</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </Cartao>
      <NovoTopico c={c} avisar={avisar} criado={(t) => setAberto(t.id)} />
    </div>
  )
}

function NovoTopico({ c, avisar, criado }) {
  const [f, setF] = useState({ titulo: '', texto: '' })
  const [erro, setErro] = useState('')
  async function publicar(e) {
    e.preventDefault()
    setErro('')
    try {
      const t = await api(`/cadeiras/${c.id}/forum`, { metodo: 'POST', corpo: f })
      setF({ titulo: '', texto: '' })
      avisar({ texto: 'Tópico publicado.' })
      criado(t)
    } catch (falha) {
      setErro(falha.message)
    }
  }
  return (
    <Cartao titulo={<><i className="fa fa-plus me-2" />Novo tópico</>}>
      <form onSubmit={publicar} className="p-formulario">
        {erro && <p className="p-erro" role="alert">{erro}</p>}
        <Campo id="f-titulo" rotulo="Assunto"><input id="f-titulo" value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} maxLength={200} required /></Campo>
        <Campo id="f-texto" rotulo="Mensagem"><textarea id="f-texto" rows={5} value={f.texto} onChange={(e) => setF({ ...f, texto: e.target.value })} maxLength={10000} required /></Campo>
        <button type="submit" className="btn btn-theme">Publicar tópico</button>
      </form>
    </Cartao>
  )
}

function Topico({ id, eDocente, avisar, voltar }) {
  const { conta } = useSessao()
  const [t, setT] = useState(null)
  const [texto, setTexto] = useState('')
  const falhou = useCallback((e) => avisar({ tipo: 'erro', texto: e.message }), [avisar])
  useEffect(() => { api(`/forum/${id}`).then(setT).catch(falhou) }, [id, falhou])
  if (!t) return <Carregando />

  const responder = (e) => {
    e.preventDefault()
    api(`/forum/${id}/respostas`, { metodo: 'POST', corpo: { texto } }).then((r) => { setT(r); setTexto('') }).catch(falhou)
  }
  const moderar = (mudanca) => api(`/forum/${id}`, { metodo: 'PUT', corpo: mudanca }).then(setT).catch(falhou)
  const apagarTopico = () => window.confirm('Apagar este tópico e todas as respostas?') && api(`/forum/${id}`, { metodo: 'DELETE' }).then(() => { avisar({ texto: 'Tópico apagado.' }); voltar() }).catch(falhou)
  const apagarResposta = (r) => window.confirm('Apagar esta resposta?') && api(`/forum-respostas/${r.id}`, { metodo: 'DELETE' }).then(() => api(`/forum/${id}`).then(setT)).catch(falhou)
  const meu = t.autor.id === conta.id

  return (
    <>
      <button type="button" className="btn btn-white mb-3" onClick={voltar}><i className="fa fa-arrow-left me-1" /> Todos os tópicos</button>
      <Cartao
        titulo={<>{t.fixado && <i className="fa fa-thumbtack me-2" />}{t.titulo}</>}
        acoes={(eDocente || (meu && !t.respostas.length)) && (
          <>
            {eDocente && <button type="button" className="btn btn-xs btn-white me-1" onClick={() => moderar({ fixado: !t.fixado })}>{t.fixado ? 'Desafixar' : 'Fixar'}</button>}
            {eDocente && <button type="button" className="btn btn-xs btn-white me-1" onClick={() => moderar({ fechado: !t.fechado })}>{t.fechado ? 'Reabrir' : 'Fechar'}</button>}
            <button type="button" className="btn btn-xs btn-danger" onClick={apagarTopico} aria-label="Apagar tópico"><i className="fa fa-trash-alt" /></button>
          </>
        )}
      >
        <Mensagem autor={t.autor} quando={t.criadoEm} texto={t.texto} />
      </Cartao>
      {t.respostas.map((r) => (
        <div key={r.id} className="panel panel-default ms-md-5">
          <div className="panel-body">
            <Mensagem autor={r.autor} quando={r.criadoEm} texto={r.texto}>
              {(eDocente || r.autor.id === conta.id) && <button type="button" className="btn btn-xs btn-white text-danger" onClick={() => apagarResposta(r)} aria-label="Apagar resposta"><i className="fa fa-times" /></button>}
            </Mensagem>
          </div>
        </div>
      ))}
      {t.fechado && !eDocente ? (
        <div className="alert alert-secondary ms-md-5"><i className="fa fa-lock me-2" />Este tópico foi fechado pelo docente.</div>
      ) : (
        <form onSubmit={responder} className="panel panel-default ms-md-5">
          <div className="panel-body p-formulario">
            <Campo id="resposta" rotulo="A sua resposta"><textarea id="resposta" rows={4} value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={10000} required /></Campo>
            <div><button type="submit" className="btn btn-theme" disabled={!texto.trim()}><i className="fa fa-reply me-1" /> Responder</button></div>
          </div>
        </form>
      )}
    </>
  )
}

function Mensagem({ autor, quando, texto, children }) {
  return (
    <div className="d-flex gap-3">
      <span className={`admin-avatar flex-shrink-0 ${autor.tipo === 'docente' ? 'bg-dark' : ''}`}>{iniciais(autor.nome)}</span>
      <div className="flex-grow-1 min-w-0">
        <div className="d-flex justify-content-between gap-2">
          <div><b>{autor.nome}</b>{autor.tipo === 'docente' && <span className="badge bg-dark ms-2">Docente</span>}<div className="small text-muted">{dataHora(quando)}</div></div>
          {children}
        </div>
        <p className="p-texto-pre mb-0 mt-2">{texto}</p>
      </div>
    </div>
  )
}

export default Forum
