import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { Carregando, Erro, Titulo } from '../componentes'
import { dataHora, ha, iniciais } from '../formatar'

/*
  Mensagens privadas (como o "messenger" do Color Admin e as mensagens do Moodle):
  à esquerda as conversas e as pessoas das minhas cadeiras; à direita a conversa aberta.
*/
function Mensagens() {
  const { id } = useParams()
  const navegar = useNavigate()
  const [conversas, setConversas] = useState(null)
  const [contactos, setContactos] = useState([])
  const [procura, setProcura] = useState('')
  const [erro, setErro] = useState('')

  const carregar = useCallback(() => api('/mensagens').then(setConversas).catch((e) => setErro(e.message)), [])
  useEffect(() => {
    carregar()
    api('/contactos').then(setContactos).catch(() => {})
  }, [carregar])

  if (erro) return <Erro texto={erro} />
  const comConversa = new Set((conversas || []).map((c) => c.pessoa.id))
  const filtro = (nome) => !procura || nome.toLowerCase().includes(procura.toLowerCase())

  return (
    <>
      <Titulo rotulo="Mensagens" titulo="Mensagens" sub="com os docentes e colegas das suas cadeiras" />
      <div className="panel panel-inverse p-mensageiro">
        <div className="row g-0">
          <div className={`col-lg-4 border-end p-lista-conversas ${id ? 'd-none d-lg-block' : ''}`}>
            <div className="p-2 border-bottom">
              <div className="input-group input-group-sm">
                <span className="input-group-text"><i className="fa fa-search" /></span>
                <input className="form-control" placeholder="Procurar pessoa" value={procura} onChange={(e) => setProcura(e.target.value)} aria-label="Procurar pessoa" />
              </div>
            </div>
            {!conversas ? <div className="p-3"><Carregando /></div> : (
              <div className="list-group list-group-flush">
                {conversas.filter((c) => filtro(c.pessoa.nome)).map((c) => (
                  <Link key={c.pessoa.id} to={`/mensagens/${c.pessoa.id}`} className={`list-group-item list-group-item-action d-flex gap-2 align-items-center ${Number(id) === c.pessoa.id ? 'active' : ''}`}>
                    <span className={`admin-avatar flex-shrink-0 ${c.pessoa.tipo === 'docente' ? 'bg-dark' : ''}`}>{iniciais(c.pessoa.nome)}</span>
                    <span className="flex-grow-1 min-w-0">
                      <span className="d-flex justify-content-between gap-2"><b className="text-truncate">{c.pessoa.nome}</b><small className="text-nowrap opacity-75">{ha(c.ultima.criadaEm)}</small></span>
                      <span className="d-block small text-truncate opacity-75">{c.ultima.minha && 'Eu: '}{c.ultima.texto}</span>
                    </span>
                    {c.naoLidas > 0 && <span className="badge bg-danger rounded-pill">{c.naoLidas}</span>}
                  </Link>
                ))}
                {contactos.filter((p) => !comConversa.has(p.id) && filtro(p.nome)).length > 0 && (
                  <div className="list-group-item p-dia-titulo">Pessoas das minhas cadeiras</div>
                )}
                {contactos.filter((p) => !comConversa.has(p.id) && filtro(p.nome)).map((p) => (
                  <Link key={p.id} to={`/mensagens/${p.id}`} className={`list-group-item list-group-item-action d-flex gap-2 align-items-center ${Number(id) === p.id ? 'active' : ''}`}>
                    <span className={`admin-avatar flex-shrink-0 ${p.tipo === 'docente' ? 'bg-dark' : ''}`}>{iniciais(p.nome)}</span>
                    <span className="min-w-0"><b className="d-block text-truncate">{p.nome}</b><small className="opacity-75">{p.papel}{p.cadeiras?.length ? ` · ${p.cadeiras.join(', ')}` : ''}</small></span>
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div className={`col-lg-8 ${id ? '' : 'd-none d-lg-block'}`}>
            {id ? <Conversa key={id} id={id} aoEnviar={carregar} voltar={() => navegar('/mensagens')} /> : (
              <div className="h-100 d-flex flex-column align-items-center justify-content-center text-muted p-5">
                <i className="fa fa-comments fa-3x mb-3 opacity-50" />
                Escolha uma conversa ou uma pessoa à esquerda.
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

function Conversa({ id, aoEnviar, voltar }) {
  const [d, setD] = useState(null)
  const [texto, setTexto] = useState('')
  const [erro, setErro] = useState('')
  const [aEnviar, setAEnviar] = useState(false)
  const fim = useRef(null)

  const carregar = useCallback(() => api(`/mensagens/${id}`).then((r) => {
    setD(r)
    setErro('')
    window.dispatchEvent(new Event('portal-avisos'))
  }).catch((e) => setErro(e.message)), [id])
  useEffect(() => {
    carregar().then(aoEnviar)
    const t = setInterval(carregar, 15_000)
    return () => clearInterval(t)
  }, [carregar, aoEnviar])
  useEffect(() => { fim.current?.scrollIntoView({ block: 'end' }) }, [d?.mensagens.length])

  async function enviar(e) {
    e.preventDefault()
    if (!texto.trim()) return
    setAEnviar(true)
    try {
      await api(`/mensagens/${id}`, { metodo: 'POST', corpo: { texto } })
      setTexto('')
      await carregar()
      aoEnviar()
    } catch (falha) {
      setErro(falha.message)
    } finally {
      setAEnviar(false)
    }
  }

  if (erro && !d) return <div className="p-3"><Erro texto={erro} /></div>
  if (!d) return <div className="p-3"><Carregando /></div>
  return (
    <div className="d-flex flex-column h-100">
      <div className="d-flex align-items-center gap-2 p-3 border-bottom">
        <button type="button" className="btn btn-white btn-sm d-lg-none" onClick={voltar} aria-label="Voltar às conversas"><i className="fa fa-arrow-left" /></button>
        <span className={`admin-avatar ${d.pessoa.tipo === 'docente' ? 'bg-dark' : ''}`}>{iniciais(d.pessoa.nome)}</span>
        <div><b>{d.pessoa.nome}</b><div className="small text-muted">{d.pessoa.papel}</div></div>
      </div>
      <div className="p-conversa flex-grow-1 p-3">
        {d.mensagens.length === 0 && <div className="text-center text-muted small py-5">Ainda não há mensagens. Escreva a primeira.</div>}
        {d.mensagens.map((m) => (
          <div key={m.id} className={`p-balao-linha ${m.minha ? 'p-minha' : ''}`}>
            <div className="p-balao">
              <div className="p-texto-pre m-0">{m.texto}</div>
              <div className="p-balao-hora" title={dataHora(m.criadaEm)}>{ha(m.criadaEm)}{m.minha && m.lidaEm && <i className="fa fa-check-double ms-1" title="Lida" />}</div>
            </div>
          </div>
        ))}
        <div ref={fim} />
      </div>
      <form onSubmit={enviar} className="border-top p-2">
        {erro && <div className="text-danger small px-1 mb-1">{erro}</div>}
        <div className="input-group">
          <textarea
            className="form-control"
            rows={2}
            maxLength={5000}
            placeholder="Escreva uma mensagem… (Enter envia, Shift+Enter muda de linha)"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(e) } }}
            aria-label="Mensagem"
          />
          <button type="submit" className="btn btn-theme" disabled={aEnviar || !texto.trim()} aria-label="Enviar"><i className="fa fa-paper-plane" /></button>
        </div>
      </form>
    </div>
  )
}

export default Mensagens
