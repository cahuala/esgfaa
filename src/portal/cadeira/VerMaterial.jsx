import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import DOMPurify from 'dompurify'
import { abrirFicheiro, api, enviarComProgresso } from '../api'
import { Bloqueio, Cartao, Vazio } from '../componentes'
import { dataHora, estadoSessao, iconeFicheiro, idYoutube, tamanho, tipoVisivel } from '../formatar'
import VerFicheiro from '../VerFicheiro'
import Livro from './Livro'
import Licao from './Licao'
import Pacote from './Pacote'
import Lti from './Lti'
import ZonaUpload from '../ZonaUpload'
import { confirmar } from '../dialogos'
import { t as tx } from '../../i18n/linguas'
import { useSessao } from '../sessaoContexto'

const EditorPagina = lazy(() => import('./EditorPagina'))

/*
  Um material aberto dentro do portal: ficheiro (PDF, vídeo, imagem…), vídeo do YouTube, página (texto),
  pasta (vários ficheiros) ou videoconferência. O estudante fica com ele marcado como visto;
  o docente edita a página e junta ou retira ficheiros.
*/
function VerMaterial({ c, eDocente, recarregar, avisar, progresso, setProgresso, so }) {
  const m = c.materiais.find((x) => x.id === so)
  const falhou = (e) => avisar({ tipo: 'erro', texto: e.message })
  const marcado = useRef(false)
  const feito = progresso?.itens.find((i) => i.tipo === 'material' && i.id === so)?.feita
  // abrir uma página ou pasta conta como visto
  useEffect(() => {
    // (a videoconferência conta ao entrar na sessão; a lição, ao chegar ao fim)
    if (eDocente || !m || m.bloqueio || marcado.current || feito || !progresso || m.tipo === 'videoconferencia' || m.tipo === 'licao' || m.tipo === 'scorm' || m.tipo === 'h5p') return
    marcado.current = true
    // concluir pode abrir atividades que dependiam desta: então a cadeira volta a carregar
    const haFechadas = [...c.materiais, ...c.trabalhos, ...c.questionarios, ...(c.inqueritos || []), ...(c.workshops || [])].some((x) => x.bloqueio)
    api(`/materiais/${m.id}/conclusao`, { metodo: 'PUT', corpo: { concluido: true } }).then((p) => { setProgresso(p); if (haFechadas) recarregar() }).catch(() => {})
  }, [eDocente, m, feito, progresso, setProgresso, c, recarregar])

  if (!m) return <Vazio>{tx('Material não encontrado.')}</Vazio>
  if (m.bloqueio) return <Cartao titulo={m.titulo}><Bloqueio motivos={m.bloqueio} /></Cartao>
  return (
    <div className="p-coluna">
      {m.tipo === 'ficheiro' && <Ficheiro m={m} falhou={falhou} />}
      {m.tipo === 'video' && <Video m={m} />}
      {m.tipo === 'ligacao' && <Ligacao m={m} />}
      {m.tipo === 'livro' && <Livro m={m} eDocente={eDocente} recarregar={recarregar} avisar={avisar} />}
      {m.tipo === 'licao' && <Licao m={m} eDocente={eDocente} recarregar={recarregar} avisar={avisar} setProgresso={setProgresso} cadeiraId={c.id} />}
      {m.tipo === 'pagina' && <Pagina m={m} eDocente={eDocente} recarregar={recarregar} avisar={avisar} />}
      {m.tipo === 'pasta' && <Pasta m={m} eDocente={eDocente} recarregar={recarregar} avisar={avisar} falhou={falhou} />}
      {m.tipo === 'lti' && <Lti m={m} falhou={falhou} />}
      {(m.tipo === 'scorm' || m.tipo === 'h5p') && <Pacote m={m} eDocente={eDocente} falhou={falhou} aoMudar={() => api(`/cadeiras/${c.id}/progresso`).then(setProgresso).catch(() => {})} />}
      {m.tipo === 'videoconferencia' && <Sessao m={m} eDocente={eDocente} feito={feito} setProgresso={setProgresso} falhou={falhou} />}
    </div>
  )
}

function Ficheiro({ m, falhou }) {
  return (
    <Cartao titulo={<><i className={`fa ${iconeFicheiro(m.ficheiro?.tipo)} me-2`} />{m.titulo}</>}>
      {m.descricao && <p className="text-muted">{m.descricao}</p>}
      {m.ficheiro ? <VerFicheiro key={m.ficheiro.id} ficheiro={m.ficheiro} titulo={m.titulo} falhou={falhou} /> : <Vazio>{tx('Ficheiro não encontrado.')}</Vazio>}
    </Cartao>
  )
}

// vídeo por endereço: o YouTube vê-se aqui; outros sites abrem à parte
function Video({ m }) {
  const id = idYoutube(m.url)
  return (
    <Cartao titulo={<><i className="fa fa-play-circle me-2" />{m.titulo}</>}>
      {m.descricao && <p className="text-muted">{m.descricao}</p>}
      {id ? (
        <div className="p-ficheiro-youtube">
          <iframe src={`https://www.youtube-nocookie.com/embed/${id}?rel=0`} title={m.titulo} allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin" />
        </div>
      ) : (
        <a className="btn btn-theme" href={m.url} target="_blank" rel="noopener noreferrer"><i className="fa fa-external-link-alt me-1" />{tx('Abrir o vídeo')}</a>
      )}
    </Cartao>
  )
}

// ligação para outro site: abre num separador novo (a sala de aula fica aberta)
function Ligacao({ m }) {
  let site = ''
  try { site = new URL(m.url).hostname.replace(/^www\./, '') } catch { /* endereço inválido */ }
  return (
    <Cartao titulo={<><i className="fa fa-link me-2" />{m.titulo}</>}>
      {m.descricao && <p className="text-muted">{m.descricao}</p>}
      <div className="p-ligacao">
        <i className="fa fa-globe-africa fa-2x text-muted" />
        <div className="flex-grow-1 min-w-0">
          <div className="fw-bold text-truncate">{site || m.url}</div>
          <div className="small text-muted text-truncate">{m.url}</div>
        </div>
        <a className="btn btn-theme" href={m.url} target="_blank" rel="noopener noreferrer"><i className="fa fa-external-link-alt me-1" />{tx('Abrir a ligação')}</a>
      </div>
    </Cartao>
  )
}

function Pagina({ m, eDocente, recarregar, avisar }) {
  const [editar, setEditar] = useState(false)
  const [html, setHtml] = useState(m.conteudo)
  const [aGuardar, setAGuardar] = useState(false)
  async function guardar() {
    setAGuardar(true)
    try {
      await api(`/materiais/${m.id}`, { metodo: 'PUT', corpo: { conteudo: html } })
      avisar({ texto: tx('Página guardada.') })
      setEditar(false)
      recarregar()
    } catch (e) {
      avisar({ tipo: 'erro', texto: e.message })
    } finally {
      setAGuardar(false)
    }
  }
  return (
    <Cartao
      titulo={<><i className="fa fa-align-left me-2" />{m.titulo}</>}
      acoes={eDocente && !editar && <button type="button" className="btn btn-xs btn-white" onClick={() => { setHtml(m.conteudo); setEditar(true) }}><i className="fa fa-pen me-1" />{tx('Editar página')}</button>}
    >
      {m.descricao && <p className="text-muted">{m.descricao}</p>}
      {editar ? (
        <>
          <Suspense fallback={<div className="text-muted small">{tx('A abrir o editor…')}</div>}>
            <EditorPagina html={html} onChange={setHtml} aoErro={(t) => avisar({ tipo: 'erro', texto: t })} />
          </Suspense>
          <div className="d-flex gap-2 mt-3">
            <button type="button" className="btn btn-theme" onClick={guardar} disabled={aGuardar}>{aGuardar ? tx('A guardar…') : tx('Guardar')}</button>
            <button type="button" className="btn btn-white" onClick={() => setEditar(false)} disabled={aGuardar}>{tx('Cancelar')}</button>
          </div>
        </>
      ) : <div className="p-programa" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(m.conteudo) }} />}
    </Cartao>
  )
}

function Pasta({ m, eDocente, recarregar, avisar, falhou }) {
  const [novos, setNovos] = useState([])
  const [aEnviar, setAEnviar] = useState(false)
  const [aberto, setAberto] = useState(null)
  const baixar = (f) => abrirFicheiro(f.id, { nome: f.nome }).catch(falhou)
  // PDF, vídeo, áudio e imagens abrem por baixo da lista; o resto descarrega-se
  const abrir = (f) => (tipoVisivel(f.tipo) ? setAberto(aberto === f.id ? null : f.id) : baixar(f))
  const emVista = m.ficheiros.find((f) => f.id === aberto)
  async function mudar(retirar = []) {
    setAEnviar(true)
    try {
      const fd = new FormData()
      for (const x of novos) fd.append('ficheiros', x.ficheiro)
      fd.append('retirarFicheiros', JSON.stringify(retirar))
      await enviarComProgresso(`/materiais/${m.id}`, fd, { metodo: 'PUT', aoProgresso: (p) => setNovos((l) => l.map((x) => ({ ...x, progresso: p }))) })
      avisar({ texto: retirar.length ? tx('Ficheiro retirado da pasta.') : tx('Ficheiros juntados à pasta.') })
      setNovos([])
      recarregar()
    } catch (e) {
      falhou(e)
    } finally {
      setAEnviar(false)
    }
  }
  return (
    <Cartao titulo={<><i className="fa fa-folder-open me-2" />{m.titulo}</>} corpo={false}>
      {m.descricao && <div className="panel-body pb-0 text-muted">{m.descricao}</div>}
      <div className="list-group list-group-flush">
        {m.ficheiros.length === 0 && <div className="list-group-item text-muted small">{tx('A pasta está vazia.')}</div>}
        {m.ficheiros.map((f) => (
          <div key={f.id} className="list-group-item d-flex align-items-center gap-3">
            <i className={`fa ${iconeFicheiro(f.tipo)} fa-lg`} />
            <button type="button" className="btn btn-link p-0 text-start text-body fw-bold text-decoration-none flex-grow-1" onClick={() => abrir(f)} aria-expanded={tipoVisivel(f.tipo) ? aberto === f.id : undefined}>{f.nome}</button>
            <span className="small text-muted text-nowrap">{tamanho(f.tamanho)}</span>
            {tipoVisivel(f.tipo) && <button type="button" className={`btn btn-xs ${aberto === f.id ? 'btn-theme' : 'btn-white'}`} onClick={() => abrir(f)}><i className="fa fa-eye me-1" />{aberto === f.id ? tx('Fechar') : tx('Ver')}</button>}
            <button type="button" className="btn btn-xs btn-white" onClick={() => baixar(f)} aria-label={tx('Descarregar {0}', { 0: f.nome })}><i className="fa fa-download" /></button>
            {eDocente && (
              <button type="button" className="btn btn-xs btn-white text-danger" disabled={aEnviar} aria-label={tx('Retirar {0}', { 0: f.nome })} onClick={async () => { if (await confirmar(tx('Retirar "{0}" da pasta?', { 0: f.nome }), { titulo: tx('Retirar ficheiro'), botao: tx('Retirar'), perigo: true })) mudar([f.id]) }}><i className="fa fa-trash-alt" /></button>
            )}
          </div>
        ))}
      </div>
      {emVista && <div className="panel-body border-top"><VerFicheiro key={emVista.id} ficheiro={emVista} titulo={emVista.nome} falhou={falhou} /></div>}
      {eDocente && (
        <div className="panel-body">
          <ZonaUpload id="pasta-novos" multiplos ficheiros={novos} aoMudar={(l) => setNovos(l.slice(0, 20))} desativado={aEnviar} nota={tx('Junte mais ficheiros a esta pasta.')} />
          {novos.length > 0 && <button type="button" className="btn btn-theme mt-2" onClick={() => mudar()} disabled={aEnviar}>{aEnviar ? tx('A enviar…') : tx('Juntar {0} ficheiro(s)', { 0: novos.length })}</button>}
        </div>
      )}
    </Cartao>
  )
}

const SESSAO = {
  em_breve: ['alert-info', tx('A sessão ainda não começou. A ligação abre 15 minutos antes.')],
  abre: ['alert-success', tx('A sessão vai começar: já pode entrar.')],
  a_decorrer: ['alert-danger', tx('A sessão está a decorrer.')],
  terminou: ['alert-secondary', tx('A sessão terminou.')],
}

// sala criada pelo portal (Jitsi): abre dentro da página
const eSalaPortal = (url) => /\/ESGFAA-[0-9a-f]{18}$/.test(url || '')

function Sessao({ m, eDocente, feito, setProgresso, falhou }) {
  const { conta } = useSessao()
  const [naSala, setNaSala] = useState(false)
  const moldura = useRef(null)
  const [, atualizar] = useState(0)
  // o estado muda com o relógio: refaz-se a cada 30 segundos
  useEffect(() => { const t = setInterval(() => atualizar((n) => n + 1), 30_000); return () => clearInterval(t) }, [])
  const e = estadoSessao(m)
  const pode = eDocente || e === 'abre' || e === 'a_decorrer'
  function entrar() {
    if (!eDocente && !feito) api(`/materiais/${m.id}/conclusao`, { metodo: 'PUT', corpo: { concluido: true } }).then(setProgresso).catch(falhou)
    if (eSalaPortal(m.url)) setNaSala(true)
    else window.open(m.url, '_blank', 'noopener')
  }
  // na sala do portal: entra já com o nome, sem o ecrã de "antes de entrar" nem o convite para instalar a aplicação
  const endereco = `${m.url}#userInfo.displayName=${encodeURIComponent(JSON.stringify(conta?.nome || ''))}&config.subject=${encodeURIComponent(JSON.stringify(m.titulo))}&config.prejoinPageEnabled=false&config.disableDeepLinking=true&interfaceConfig.MOBILE_APP_PROMO=false`
  return (
    <Cartao titulo={<><i className="fa fa-video me-2" />{m.titulo}</>}>
      <div className="d-flex flex-wrap gap-4 mb-3">
        <div><span className="small text-muted d-block">{tx('Início')}</span><b>{dataHora(m.inicio)}</b></div>
        <div><span className="small text-muted d-block">{tx('Duração')}</span><b>{m.duracao} {tx('minutos')}</b></div>
      </div>
      {m.descricao && <p className="p-texto-pre">{m.descricao}</p>}
      <div className={`alert ${SESSAO[e][0]} d-flex align-items-center gap-3 mb-0`}>
        <span className="flex-grow-1">{SESSAO[e][1]}</span>
        {pode && e !== 'terminou' && <button type="button" className="btn btn-success" onClick={entrar}><i className="fa fa-sign-in-alt me-1" />{tx('Entrar na sessão')}</button>}
        {eDocente && e === 'terminou' && <button type="button" className="btn btn-white" onClick={entrar}>{tx('Abrir a ligação')}</button>}
      </div>
      {naSala && (
        <div className="p-sala-video mt-3" ref={moldura}>
          <div className="p-sala-video-barra">
            <span className="flex-grow-1"><span className="p-ao-vivo" />{tx('Na sala: {0}', { 0: m.titulo })}</span>
            <button type="button" className="btn btn-sm btn-white" onClick={() => moldura.current?.requestFullscreen?.()}><i className="fa fa-expand me-1" />{tx('Ecrã inteiro')}</button>
            <a className="btn btn-sm btn-white" href={endereco} target="_blank" rel="noopener noreferrer" onClick={() => setNaSala(false)}><i className="fa fa-external-link-alt me-1" />{tx('Abrir noutra janela')}</a>
            <button type="button" className="btn btn-sm btn-danger" onClick={() => setNaSala(false)}><i className="fa fa-phone-slash me-1" />{tx('Sair da sala')}</button>
          </div>
          <iframe title={m.titulo} src={endereco} allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write" allowFullScreen />
        </div>
      )}
    </Cartao>
  )
}

export default VerMaterial
