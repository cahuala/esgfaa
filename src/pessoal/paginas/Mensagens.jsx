import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { abrirFicheiro, api } from '../api'
import { useSessao } from '../sessao'
import { useDados } from '../useDados'
import Foto from '../componentes/Foto'
import { Cabecalho, Campo, Carregando, Modal } from '../componentes/Ui'

const hora = (iso) => new Date(iso).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const ICONE = { geral: 'fa-landmark', unidade: 'fa-building', grupo: 'fa-users' }
const avisarMenu = () => window.dispatchEvent(new Event('pes-avisos'))

// mensagens internas: conversa geral da Escola, a da unidade, directas e grupos (actualiza de 4 em 4 segundos)
export default function Mensagens() {
  const { id } = useParams()
  const navegar = useNavigate()
  const { dados: conversas, recarregar } = useDados('/mensagens/conversas', undefined, { tempoReal: true })
  const [modal, setModal] = useState(null)
  // a lista também se actualiza (mensagens por ler, última mensagem)
  useEffect(() => { const t = setInterval(recarregar, 10_000); return () => clearInterval(t) }, [recarregar])
  const atual = id ? Number(id) : conversas?.[0]?.id
  const abrir = async (caminho, corpo) => {
    const r = await api(caminho, { metodo: 'POST', corpo })
    setModal(null)
    recarregar()
    navegar(`/mensagens/${r.id}`)
  }
  return (
    <>
      <Cabecalho titulo="Mensagens" subtitulo="conversas internas da Escola" migalhas={[['Mensagens']]}>
        <button type="button" className="btn btn-theme" onClick={() => setModal('directa')}><i className="fa fa-comment-medical me-1" />Nova conversa</button>
        <button type="button" className="btn btn-outline-theme" onClick={() => setModal('grupo')}><i className="fa fa-users me-1" />Novo grupo</button>
      </Cabecalho>
      <div className="panel panel-inverse mb-0">
        <div className="pes-chat">
          <div className="pes-chat-lista">
            {!conversas ? <Carregando /> : conversas.map((c) => (
              <button key={c.id} type="button" className={c.id === atual ? 'ativo' : ''} onClick={() => navegar(`/mensagens/${c.id}`)}>
                {c.tipo === 'directa' ? <Foto pessoaId={c.pessoaId} fotoId={c.fotoId} nome={c.nome} tamanho={38} /> : <span className="pes-avatar pes-avatar-vazio" style={{ width: 38, height: 38 }}><i className={`fa ${ICONE[c.tipo]}`} /></span>}
                <span className="flex-grow-1 text-truncate">
                  <span className="d-flex"><strong className="text-truncate me-auto">{c.nome}</strong>{c.naoLidas > 0 && <span className="badge bg-danger rounded-pill ms-1">{c.naoLidas}</span>}</span>
                  <span className="small text-muted d-block text-truncate">{c.ultima ? `${c.ultima.minha ? 'Eu' : c.ultima.autor.split(' ')[0]}: ${c.ultima.texto}` : c.tipo === 'geral' ? 'Todos os militares e civis da Escola' : c.tipo === 'unidade' ? 'Quem está na sua unidade' : 'Sem mensagens'}</span>
                </span>
              </button>
            ))}
          </div>
          {atual ? <Conversa key={atual} id={atual} aoMudar={recarregar} /> : <div className="p-4 text-muted">Escolha uma conversa.</div>}
        </div>
      </div>
      {modal === 'directa' && <EscolherContacto aoFechar={() => setModal(null)} aoEscolher={(c) => abrir('/mensagens/directa', { utilizadorId: c.id })} />}
      {modal === 'grupo' && <NovoGrupo aoFechar={() => setModal(null)} aoCriar={(d) => abrir('/mensagens/grupo', d)} />}
    </>
  )
}

function Conversa({ id, aoMudar }) {
  const { avisar } = useSessao()
  const [estado, setEstado] = useState({ conversa: null, mensagens: [] })
  const [texto, setTexto] = useState('')
  const [anexo, setAnexo] = useState(null)
  const fim = useRef(null)
  const ultimo = useRef(0)
  // anexo: arrastado para a conversa ou escolhido no clipe (até 25 MB: PDF, imagens, Word, Excel)
  const escolherAnexo = (f) => {
    if (!f) return
    if (f.size > 25 * 1048576) return avisar(`${f.name} tem mais de 25 MB.`, 'erro')
    if (!/^(application\/pdf|image\/(jpeg|png|webp))$/.test(f.type) && !/\.(docx|xlsx)$/i.test(f.name)) return avisar('Só PDF, imagens (JPG, PNG, WEBP), Word (.docx) ou Excel (.xlsx).', 'erro')
    setAnexo(f)
  }

  useEffect(() => {
    let vivo = true
    ultimo.current = 0
    const buscar = () => api(`/mensagens/conversas/${id}`, { consulta: { depois: ultimo.current || undefined } }).then((r) => {
      if (!vivo) return
      if (r.mensagens.length) {
        ultimo.current = r.mensagens.at(-1).id
        setEstado((e) => ({ conversa: r.conversa, mensagens: [...e.mensagens, ...r.mensagens.filter((m) => !e.mensagens.some((x) => x.id === m.id))] }))
        avisarMenu()
        aoMudar()
      } else setEstado((e) => (e.conversa ? e : { ...e, conversa: r.conversa }))
    }).catch(() => {})
    buscar()
    const t = setInterval(buscar, 4000)
    // a mensagem nova chega logo (aviso instantâneo); o intervalo fica de reserva
    window.addEventListener('pes-tempo-real', buscar)
    return () => { vivo = false; clearInterval(t); window.removeEventListener('pes-tempo-real', buscar) }
  }, [id, aoMudar])
  useEffect(() => { fim.current?.scrollIntoView({ block: 'end' }) }, [estado.mensagens.length])

  async function enviar(e) {
    e?.preventDefault()
    if (!texto.trim() && !anexo) return
    const fd = new FormData()
    fd.append('texto', texto)
    if (anexo) fd.append('ficheiro', anexo)
    try {
      await api(`/mensagens/conversas/${id}`, { metodo: 'POST', formulario: fd })
      setTexto('')
      setAnexo(null)
      const r = await api(`/mensagens/conversas/${id}`, { consulta: { depois: ultimo.current || undefined } })
      if (r.mensagens.length) {
        ultimo.current = r.mensagens.at(-1).id
        setEstado((s) => ({ ...s, mensagens: [...s.mensagens, ...r.mensagens.filter((m) => !s.mensagens.some((x) => x.id === m.id))] }))
      }
      aoMudar()
    } catch (x) {
      avisar(x.message, 'erro')
    }
  }
  const grupo = estado.conversa && estado.conversa.tipo !== 'directa'
  return (
    <div className="pes-chat-conversa" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); escolherAnexo(e.dataTransfer.files[0]) }}>
      <div className="p-2 border-bottom bg-white"><strong>{estado.conversa?.nome || (estado.conversa?.tipo === 'directa' ? 'Conversa directa' : '')}</strong></div>
      <div className="pes-chat-mensagens">
        {!estado.conversa && <Carregando />}
        {estado.conversa && !estado.mensagens.length && <p className="text-muted text-center">Ainda não há mensagens. Escreva a primeira.</p>}
        {estado.mensagens.map((m) => (
          <div key={m.id} className={`pes-msg ${m.minha ? 'minha' : ''}`}>
            {!m.minha && <Foto pessoaId={m.pessoaId} fotoId={m.fotoId} nome={m.autor} tamanho={30} />}
            <div className="pes-msg-balao">
              {grupo && !m.minha && <div className="pes-msg-autor">{m.autor}</div>}
              {m.texto}
              {m.anexo && <div><button type="button" className="btn btn-link btn-sm p-0" onClick={() => abrirFicheiro(`/mensagens/anexo/${m.id}`, m.anexo.nome).catch((x) => avisar(x.message, 'erro'))}><i className="fa fa-paperclip me-1" />{m.anexo.nome}</button></div>}
              <div className="pes-msg-hora">{hora(m.criadoEm)}</div>
            </div>
          </div>
        ))}
        <div ref={fim} />
      </div>
      <form className="pes-chat-escrever" onSubmit={enviar}>
        <label className="btn btn-outline-secondary mb-0" title="Juntar ficheiro"><i className="fa fa-paperclip" /><input type="file" hidden onChange={(e) => { escolherAnexo(e.target.files[0]); e.target.value = '' }} /></label>
        <div className="flex-grow-1">
          {anexo && <div className="small text-muted">📎 {anexo.name} <button type="button" className="btn btn-link btn-sm p-0" onClick={() => setAnexo(null)}>retirar</button></div>}
          <textarea className="form-control" rows={1} placeholder="Escreva uma mensagem… (Enter envia; Shift+Enter muda de linha)" value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) enviar(e) }} aria-label="Mensagem" />
        </div>
        <button type="submit" className="btn btn-theme" disabled={!texto.trim() && !anexo} aria-label="Enviar"><i className="fa fa-paper-plane" /></button>
      </form>
    </div>
  )
}

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function ListaContactos({ escolhidos = [], aoEscolher }) {
  const { dados } = useDados('/mensagens/contactos')
  const [q, setQ] = useState('')
  const l = useMemo(() => (dados ?? []).filter((c) => norm(`${c.nome} ${c.unidadeNome}`).includes(norm(q))), [dados, q])
  return (
    <>
      <input type="search" className="form-control mb-2" placeholder="Procurar por nome ou unidade…" value={q} onChange={(e) => setQ(e.target.value)} />
      {!dados ? <Carregando /> : (
        <div className="list-group" style={{ maxHeight: 360, overflow: 'auto' }}>
          {l.map((c) => (
            <button key={c.id} type="button" className={`list-group-item list-group-item-action d-flex align-items-center gap-2 ${escolhidos.includes(c.id) ? 'active' : ''}`} onClick={() => aoEscolher(c)}>
              <Foto pessoaId={c.pessoaId} fotoId={c.fotoId} nome={c.nome} /><span><strong>{c.nome}</strong><div className="small opacity-75">{c.unidadeNome}</div></span>
            </button>
          ))}
          {!l.length && <div className="list-group-item text-muted">Ninguém com esse nome.</div>}
        </div>
      )}
    </>
  )
}

function EscolherContacto({ aoFechar, aoEscolher }) {
  return <Modal titulo="Nova conversa" aoFechar={aoFechar}><ListaContactos aoEscolher={aoEscolher} /></Modal>
}

function NovoGrupo({ aoFechar, aoCriar }) {
  const [nome, setNome] = useState('')
  const [membros, setMembros] = useState([])
  return (
    <Modal titulo="Novo grupo" aoFechar={aoFechar} rodape={<><button type="button" className="btn btn-outline-secondary" onClick={aoFechar}>Cancelar</button><button type="button" className="btn btn-theme" disabled={nome.trim().length < 2 || membros.length < 2} onClick={() => aoCriar({ nome, membros })}>Criar grupo ({membros.length + 1})</button></>}>
      <Campo rotulo="Nome do grupo" col="col-12"><input className="form-control mb-2" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Docentes do CEM 2026" /></Campo>
      <ListaContactos escolhidos={membros} aoEscolher={(c) => setMembros((m) => (m.includes(c.id) ? m.filter((x) => x !== c.id) : [...m, c.id]))} />
    </Modal>
  )
}
