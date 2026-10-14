import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { abrirFicheiro, api, enviarComProgresso } from '../api'
import { useSessao } from '../sessaoContexto'
import { Campo, Cartao, Carregando, Vazio } from '../componentes'
import { dataHora, iconeFicheiro, iniciais } from '../formatar'
import ZonaUpload from '../ZonaUpload'
import { confirmar } from '../dialogos'

// envia texto e anexos (multipart) e devolve a resposta da API
function enviar(caminho, campos, anexos) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(campos)) fd.append(k, v)
  for (const x of anexos) fd.append('ficheiros', x.ficheiro)
  return enviarComProgresso(caminho, fd)
}

/*
  Fórum da cadeira (como o do Moodle): tópicos de discussão e de perguntas e respostas, anexos,
  resposta certa, seguir o fórum ou um tópico, pesquisa e moderação pelo docente.
  O tópico aberto fica no endereço (?topico=), para os avisos abrirem diretamente.
*/
function Forum({ c, eDocente, avisar }) {
  const [params, setParams] = useSearchParams()
  const aberto = Number(params.get('topico')) || null
  const abrir = (id) => setParams(id ? { separador: 'forum', topico: String(id) } : { separador: 'forum' })
  const [lista, setLista] = useState(null)
  const [q, setQ] = useState('')
  const [pesquisa, setPesquisa] = useState('')
  const [seguido, setSeguido] = useState(false)
  const falhou = useCallback((e) => avisar({ tipo: 'erro', texto: e.message }), [avisar])
  const carregar = useCallback(() => api(`/cadeiras/${c.id}/forum${pesquisa ? `?q=${encodeURIComponent(pesquisa)}` : ''}`).then(setLista).catch(falhou), [c.id, pesquisa, falhou])
  useEffect(() => { if (!aberto) carregar() }, [carregar, aberto])
  useEffect(() => { api(`/cadeiras/${c.id}/forum/subscricao`).then((r) => setSeguido(r.seguido)).catch(() => {}) }, [c.id])

  if (aberto) return <Topico id={aberto} eDocente={eDocente} avisar={avisar} voltar={() => abrir(null)} />
  if (!lista) return <Carregando />

  const seguir = () => api(`/cadeiras/${c.id}/forum/subscricao`, { metodo: 'PUT', corpo: { ativa: !seguido } })
    .then((r) => { setSeguido(r.seguido); avisar({ texto: r.seguido ? 'Passa a receber avisos de todos os tópicos e respostas.' : 'Deixou de seguir o fórum.' }) }).catch(falhou)

  return (
    <div className="p-grelha-lado">
      <Cartao
        titulo={<><i className="fa fa-comments me-2" />Fórum da cadeira</>}
        acoes={<button type="button" className={`btn btn-xs ${seguido ? 'btn-success' : 'btn-white'}`} onClick={seguir}><i className={`fa ${seguido ? 'fa-bell' : 'fa-bell-slash'} me-1`} />{seguido ? 'A seguir o fórum' : 'Seguir o fórum'}</button>}
        corpo={false}
      >
        <form className="panel-body d-flex gap-2 pb-0" onSubmit={(e) => { e.preventDefault(); setPesquisa(q.trim()) }} role="search">
          <input className="form-control" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar no fórum (assunto, mensagens e respostas)" aria-label="Pesquisar no fórum" />
          <button type="submit" className="btn btn-white" aria-label="Pesquisar"><i className="fa fa-search" /></button>
          {pesquisa && <button type="button" className="btn btn-white" onClick={() => { setQ(''); setPesquisa('') }}>Limpar</button>}
        </form>
        {lista.length === 0 ? <div className="panel-body"><Vazio>{pesquisa ? `Nada encontrado para "${pesquisa}".` : 'Ainda não há tópicos. Comece a conversa.'}</Vazio></div> : (
          <div className="list-group list-group-flush mt-3">
            {lista.map((t) => (
              <button key={t.id} type="button" className="list-group-item list-group-item-action d-flex gap-3 align-items-start text-start" onClick={() => abrir(t.id)}>
                <span className="admin-avatar flex-shrink-0">{iniciais(t.autor.nome)}</span>
                <span className="flex-grow-1 min-w-0">
                  <span className="d-block fw-bold">
                    {t.fixado && <i className="fa fa-thumbtack text-danger me-1" title="Fixado" />}
                    {t.fechado && <i className="fa fa-lock text-muted me-1" title="Fechado" />}
                    {t.tipo === 'pergunta' && <span className="badge bg-purple me-1">Perguntas e respostas</span>}
                    {t.respostaCertaId && <span className="badge bg-success me-1"><i className="fa fa-check me-1" />Resolvido</span>}
                    {t.titulo}
                  </span>
                  <span className="d-block small text-muted">{t.autor.nome}{t.autor.tipo === 'docente' && ' (docente)'} · {dataHora(t.criadoEm)}{t.anexos > 0 && <> · <i className="fa fa-paperclip" /> {t.anexos}</>}</span>
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
      <NovoTopico c={c} eDocente={eDocente} avisar={avisar} criado={(t) => abrir(t.id)} />
    </div>
  )
}

function NovoTopico({ c, eDocente, avisar, criado }) {
  const [f, setF] = useState({ titulo: '', texto: '', tipo: 'discussao' })
  const [anexos, setAnexos] = useState([])
  const [erro, setErro] = useState('')
  const [aEnviar, setAEnviar] = useState(false)
  async function publicar(e) {
    e.preventDefault()
    setErro('')
    setAEnviar(true)
    try {
      const t = await enviar(`/cadeiras/${c.id}/forum`, f, anexos)
      setF({ titulo: '', texto: '', tipo: 'discussao' })
      setAnexos([])
      avisar({ texto: 'Tópico publicado.' })
      criado(t)
    } catch (falha) {
      setErro(falha.message)
    } finally {
      setAEnviar(false)
    }
  }
  return (
    <Cartao titulo={<><i className="fa fa-plus me-2" />Novo tópico</>}>
      <form onSubmit={publicar} className="p-formulario">
        {erro && <p className="p-erro" role="alert">{erro}</p>}
        {eDocente && (
          <Campo id="f-tipo" rotulo="Tipo" ajuda={f.tipo === 'pergunta' ? 'Cada estudante só vê as respostas dos colegas depois de responder.' : undefined}>
            <select id="f-tipo" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}><option value="discussao">Discussão</option><option value="pergunta">Perguntas e respostas</option></select>
          </Campo>
        )}
        <Campo id="f-titulo" rotulo="Assunto"><input id="f-titulo" value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} maxLength={200} required /></Campo>
        <Campo id="f-texto" rotulo="Mensagem"><textarea id="f-texto" rows={5} value={f.texto} onChange={(e) => setF({ ...f, texto: e.target.value })} maxLength={10000} required /></Campo>
        <ZonaUpload id="f-anexos" multiplos ficheiros={anexos} aoMudar={(l) => setAnexos(l.slice(0, 3))} desativado={aEnviar} nota="Anexos (opcional): até 3 ficheiros." />
        <div><button type="submit" className="btn btn-theme" disabled={aEnviar}>{aEnviar ? 'A publicar…' : 'Publicar tópico'}</button></div>
      </form>
    </Cartao>
  )
}

function Topico({ id, eDocente, avisar, voltar }) {
  const { conta } = useSessao()
  const [t, setT] = useState(null)
  const [texto, setTexto] = useState('')
  const [anexos, setAnexos] = useState([])
  const [aEnviar, setAEnviar] = useState(false)
  const [editar, setEditar] = useState(null) // { tipo: 'topico'|'resposta', id, texto }
  const falhou = useCallback((e) => avisar({ tipo: 'erro', texto: e.message }), [avisar])
  const recarregar = useCallback(() => api(`/forum/${id}`).then(setT).catch(falhou), [id, falhou])
  useEffect(() => { recarregar() }, [recarregar])
  if (!t) return <Carregando />

  async function responder(e) {
    e.preventDefault()
    setAEnviar(true)
    try {
      setT(await enviar(`/forum/${id}/respostas`, { texto }, anexos))
      setTexto('')
      setAnexos([])
    } catch (falha) {
      falhou(falha)
    } finally {
      setAEnviar(false)
    }
  }
  const moderar = (mudanca) => api(`/forum/${id}`, { metodo: 'PUT', corpo: mudanca }).then(recarregar).catch(falhou)
  const apagarTopico = async () => (await confirmar('Apagar este tópico e todas as respostas?', { titulo: 'Apagar tópico', botao: 'Apagar', perigo: true })) && api(`/forum/${id}`, { metodo: 'DELETE' }).then(() => { avisar({ texto: 'Tópico apagado.' }); voltar() }).catch(falhou)
  const apagarResposta = async (r) => (await confirmar('Apagar esta resposta?', { titulo: 'Apagar resposta', botao: 'Apagar', perigo: true })) && api(`/forum-respostas/${r.id}`, { metodo: 'DELETE' }).then(recarregar).catch(falhou)
  const certa = (respostaId) => api(`/forum/${id}/certa`, { metodo: 'PUT', corpo: { respostaId } }).then(setT).catch(falhou)
  const seguir = () => api(`/forum/${id}/subscricao`, { metodo: 'PUT', corpo: { ativa: !t.seguido } }).then((r) => setT({ ...t, seguido: r.seguido })).catch(falhou)
  async function guardarEdicao() {
    try {
      const url = editar.tipo === 'topico' ? `/forum/${id}/texto` : `/forum-respostas/${editar.id}`
      setT(await api(url, { metodo: 'PUT', corpo: { texto: editar.texto } }))
      setEditar(null)
    } catch (e) {
      falhou(e)
    }
  }
  const meu = t.autor.id === conta.id
  const podeMarcar = eDocente || meu
  const caixaEdicao = (
    <div className="mt-2">
      <textarea className="form-control" rows={4} value={editar?.texto || ''} onChange={(e) => setEditar({ ...editar, texto: e.target.value })} aria-label="Editar mensagem" />
      <div className="d-flex gap-2 mt-2"><button type="button" className="btn btn-sm btn-theme" onClick={guardarEdicao}>Guardar</button><button type="button" className="btn btn-sm btn-white" onClick={() => setEditar(null)}>Cancelar</button></div>
    </div>
  )
  // a resposta certa aparece logo a seguir à pergunta
  const respostas = [...t.respostas].sort((a, b) => (b.id === t.respostaCertaId) - (a.id === t.respostaCertaId))

  return (
    <>
      <div className="d-flex gap-2 mb-3">
        <button type="button" className="btn btn-white" onClick={voltar}><i className="fa fa-arrow-left me-1" /> Todos os tópicos</button>
        <button type="button" className={`btn ms-auto ${t.seguido ? 'btn-success' : 'btn-white'}`} onClick={seguir}><i className={`fa ${t.seguido ? 'fa-bell' : 'fa-bell-slash'} me-1`} />{t.seguido ? 'A seguir este tópico' : 'Seguir este tópico'}</button>
      </div>
      <Cartao
        titulo={<>{t.fixado && <i className="fa fa-thumbtack me-2" />}{t.tipo === 'pergunta' && <span className="badge bg-purple me-2">Perguntas e respostas</span>}{t.titulo}</>}
        acoes={(
          <>
            {t.podeEditar && <button type="button" className="btn btn-xs btn-white me-1" onClick={() => setEditar({ tipo: 'topico', texto: t.texto })}><i className="fa fa-pen me-1" />Editar</button>}
            {eDocente && <button type="button" className="btn btn-xs btn-white me-1" onClick={() => moderar({ fixado: !t.fixado })}>{t.fixado ? 'Desafixar' : 'Fixar'}</button>}
            {eDocente && <button type="button" className="btn btn-xs btn-white me-1" onClick={() => moderar({ fechado: !t.fechado })}>{t.fechado ? 'Reabrir' : 'Fechar'}</button>}
            {(eDocente || (meu && !t.respostas.length)) && <button type="button" className="btn btn-xs btn-danger" onClick={apagarTopico} aria-label="Apagar tópico"><i className="fa fa-trash-alt" /></button>}
          </>
        )}
      >
        <Mensagem m={t}>{editar?.tipo === 'topico' && caixaEdicao}</Mensagem>
      </Cartao>
      {t.respostasEscondidas > 0 && <div className="alert alert-info ms-md-5"><i className="fa fa-eye-slash me-2" />Há {t.respostasEscondidas} resposta(s). Neste tópico de perguntas e respostas, vê as respostas dos colegas depois de publicar a sua.</div>}
      {respostas.map((r) => {
        const eCerta = r.id === t.respostaCertaId
        return (
          <div key={r.id} className={`panel ms-md-5 ${eCerta ? 'panel-success border border-success' : 'panel-default'}`}>
            <div className="panel-body">
              {eCerta && <div className="text-success fw-bold small mb-2"><i className="fa fa-check-circle me-1" />Resposta certa</div>}
              <Mensagem m={r} acoes={(
                <div className="d-flex gap-1 flex-shrink-0">
                  {podeMarcar && <button type="button" className={`btn btn-xs ${eCerta ? 'btn-success' : 'btn-white'}`} onClick={() => certa(eCerta ? null : r.id)} title={eCerta ? 'Desmarcar' : 'Marcar como resposta certa'}><i className="fa fa-check" />{!eCerta && <span className="ms-1 d-none d-md-inline">Certa</span>}</button>}
                  {r.podeEditar && <button type="button" className="btn btn-xs btn-white" onClick={() => setEditar({ tipo: 'resposta', id: r.id, texto: r.texto })} aria-label="Editar resposta"><i className="fa fa-pen" /></button>}
                  {(eDocente || r.autor.id === conta.id) && <button type="button" className="btn btn-xs btn-white text-danger" onClick={() => apagarResposta(r)} aria-label="Apagar resposta"><i className="fa fa-times" /></button>}
                </div>
              )}>
                {editar?.tipo === 'resposta' && editar.id === r.id && caixaEdicao}
              </Mensagem>
            </div>
          </div>
        )
      })}
      {t.fechado && !eDocente ? (
        <div className="alert alert-secondary ms-md-5"><i className="fa fa-lock me-2" />Este tópico foi fechado pelo docente.</div>
      ) : (
        <form onSubmit={responder} className="panel panel-default ms-md-5">
          <div className="panel-body p-formulario">
            <Campo id="resposta" rotulo="A sua resposta"><textarea id="resposta" rows={4} value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={10000} required /></Campo>
            <ZonaUpload id="r-anexos" multiplos ficheiros={anexos} aoMudar={(l) => setAnexos(l.slice(0, 3))} desativado={aEnviar} nota="Anexos (opcional): até 3 ficheiros." />
            <div><button type="submit" className="btn btn-theme" disabled={!texto.trim() || aEnviar}><i className="fa fa-reply me-1" /> {aEnviar ? 'A enviar…' : 'Responder'}</button></div>
          </div>
        </form>
      )}
    </>
  )
}

function Mensagem({ m, acoes, children }) {
  const baixar = (f) => abrirFicheiro(f.id, { nome: f.nome, ver: /^(application\/pdf|image\/)/.test(f.tipo) }).catch(() => {})
  return (
    <div className="d-flex gap-3">
      <span className={`admin-avatar flex-shrink-0 ${m.autor.tipo === 'docente' ? 'bg-dark' : ''}`}>{iniciais(m.autor.nome)}</span>
      <div className="flex-grow-1 min-w-0">
        <div className="d-flex justify-content-between gap-2">
          <div>
            <b>{m.autor.nome}</b>{m.autor.tipo === 'docente' && <span className="badge bg-dark ms-2">Docente</span>}
            <div className="small text-muted">{dataHora(m.criadoEm)}{m.editadoEm && ` · editado ${dataHora(m.editadoEm)}`}</div>
          </div>
          {acoes}
        </div>
        {children || <p className="p-texto-pre mb-0 mt-2">{m.texto}</p>}
        {m.anexos?.length > 0 && (
          <div className="d-flex flex-wrap gap-2 mt-2">
            {m.anexos.map((f) => <button key={f.id} type="button" className="btn btn-sm btn-white" onClick={() => baixar(f)}><i className={`fa ${iconeFicheiro(f.tipo)} me-1`} />{f.nome}</button>)}
          </div>
        )}
      </div>
    </div>
  )
}

export default Forum
