import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../api'
import { Aviso, CabecalhoPagina, Carregando, Erro, Painel } from '../../componentes/Ui'
import { confirmar } from '../../../portal/dialogos'
import Relatorio, { ChipIA, ChipOriginalidade } from '../../../portal/integridade/Relatorio'

const dia = (iso) => (iso ? new Date(iso).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' }) : '')
const FILTROS = { todas: 'Todas', alto: 'Elevada (35 % ou mais)', medio: 'A rever (15 a 35 %)', baixo: 'Baixa', ia: 'Indícios de IA (50 % ou mais)', erro: 'Sem texto' }
const ACEITAR = 'application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document'

// Integridade académica (anti-plágio): análises, verificação avulsa e repositório de referência
function Integridade() {
  const { id } = useParams()
  return id ? <VerAnalise key={id} id={id} /> : <PainelIntegridade />
}

function PainelIntegridade() {
  const [d, setD] = useState(null)
  const [repo, setRepo] = useState(null)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState(null)
  const [filtro, setFiltro] = useState('todas')
  const [q, setQ] = useState('')
  const falhou = useCallback((e) => setAviso({ tipo: 'erro', texto: e.message }), [])
  const carregar = useCallback(() => {
    api('/integridade').then(setD).catch((e) => setErro(e.message))
    api('/integridade/repositorio').then(setRepo).catch(() => {})
  }, [])
  useEffect(() => { carregar() }, [carregar])
  useEffect(() => {
    if (!d?.analises.some((a) => a.estado === 'pendente')) return undefined
    const t = setTimeout(carregar, 3000)
    return () => clearTimeout(t)
  }, [d, carregar])
  const lista = useMemo(() => (d?.analises || []).filter((a) => {
    if (filtro === 'ia') { if (!(a.iaPontuacao >= 50)) return false } else if (filtro === 'erro' ? a.estado !== 'erro' : filtro !== 'todas' && a.nivel?.nivel !== filtro) return false
    const t = `${a.documento.titulo} ${a.documento.autor} ${a.documento.contexto}`.toLowerCase()
    return !q.trim() || t.includes(q.trim().toLowerCase())
  }), [d, filtro, q])
  if (erro) return <Erro texto={erro} />
  if (!d) return <Carregando />

  async function reindexar() {
    if (!(await confirmar('Indexar as obras digitais da biblioteca e verificar os trabalhos entregues antes de haver anti-plágio? Pode demorar alguns minutos, em segundo plano.', { titulo: 'Indexar o acervo', botao: 'Indexar' }))) return
    await api('/integridade/reindexar', { metodo: 'POST' }).then((r) => { setAviso({ texto: `Em curso: ${r.obras} obra(s) da biblioteca e ${r.entregas} entrega(s).` }); setTimeout(carregar, 3000) }).catch(falhou)
  }
  const numeros = [
    ['Análises', d.total, 'fa-fingerprint', 'bg-dark'],
    ['Semelhança elevada', d.altas, 'fa-exclamation-triangle', 'bg-danger'],
    ['Trabalhos indexados', d.fontes.entrega || 0, 'fa-inbox', 'bg-info'],
    ['Obras da biblioteca', d.fontes.biblioteca || 0, 'fa-book', 'bg-success'],
    ['Documentos de referência', d.fontes.repositorio || 0, 'fa-archive', 'bg-purple'],
  ]
  return (
    <>
      <CabecalhoPagina titulo="Integridade académica" subtitulo="verificação de originalidade (anti-plágio)" migalhas={[{ rotulo: 'Administração Escolar' }, { rotulo: 'Integridade académica' }]}>
        <button type="button" className="btn btn-white" onClick={reindexar}><i className="fa fa-sync me-1" />Indexar o acervo</button>
      </CabecalhoPagina>
      <div className="row g-3 mb-3">
        {numeros.map(([r, v, i, c]) => (
          <div key={r} className="col-6 col-md"><div className={`widget widget-stats ${c} mb-0`}><div className="stats-icon"><i className={`fa ${i}`} /></div><div className="stats-info"><h4>{r}</h4><p>{v}</p></div></div></div>
        ))}
      </div>
      <div className="row">
        <div className="col-xl-8">
          <Painel titulo={`Análises (${lista.length})`} corpo={false}>
            <div className="p-3 d-flex flex-wrap gap-2 border-bottom">
              <input type="search" className="form-control" style={{ maxWidth: 320 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Título, autor ou cadeira" aria-label="Procurar análises" />
              <select className="form-select w-auto" value={filtro} onChange={(e) => setFiltro(e.target.value)} aria-label="Filtrar por semelhança">{Object.entries(FILTROS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            </div>
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead><tr><th>Documento</th><th>Origem</th><th>Maior fonte</th><th className="text-center">Semelhança</th></tr></thead>
                <tbody>
                  {lista.length === 0 && <tr><td colSpan={4} className="text-center text-muted py-4">Sem análises{filtro !== 'todas' || q ? ' com estes filtros' : ''}.</td></tr>}
                  {lista.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <Link to={`/integridade/analises/${a.id}`} className="fw-bold text-body">{a.documento.titulo}</Link>
                        <div className="small text-muted">{[a.documento.autor, a.documento.contexto, dia(a.criadaEm)].filter(Boolean).join(' · ')}</div>
                      </td>
                      <td className="small">{d.origens[a.documento.origem]}</td>
                      <td className="small">{a.fontes?.[0] ? <>{a.fontes[0].titulo}<span className="text-muted"> · {String(a.fontes[0].percentagem).replace('.', ',')}%</span></> : <span className="text-muted">—</span>}</td>
                      <td className="text-center"><Link to={`/integridade/analises/${a.id}`} className="d-inline-flex gap-1"><ChipOriginalidade a={a} /><ChipIA a={a} /></Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Painel>
        </div>
        <div className="col-xl-4">
          <Enviar titulo="Verificar um documento" icone="fa-search" caminho="/integridade/verificar" botao="Verificar" guardar
            nota="TFC, tese ou artigo a avaliar. O ficheiro não fica guardado: só o texto." feito={(r) => { setAviso({ texto: `"${r.documento.titulo}" em verificação.` }); carregar() }} falhou={falhou} />
          <Enviar titulo="Repositório de referência" icone="fa-archive" caminho="/integridade/repositorio" botao="Juntar ao repositório" contexto
            nota="Teses, TFC de anos anteriores e outros textos com que os trabalhos passam a ser comparados." feito={(r) => { setAviso({ texto: `"${r.titulo}" juntado ao repositório (${r.palavras} palavras).` }); carregar() }} falhou={falhou} />
          <Repositorio l={repo} origens={d.origens} carregar={carregar} falhou={falhou} />
        </div>
      </div>
      <Aviso aviso={aviso} onFechar={() => setAviso(null)} />
    </>
  )
}

function Enviar({ titulo, icone, caminho, botao, nota, guardar, contexto, feito, falhou }) {
  const [f, setF] = useState({ titulo: '', autor: '', contexto: '', guardar: false })
  const [ficheiro, setFicheiro] = useState(null)
  const [aEnviar, setAEnviar] = useState(false)
  const [chave, setChave] = useState(0)
  async function enviar(e) {
    e.preventDefault()
    if (!ficheiro) return falhou(new Error('Escolha o documento (PDF ou Word).'))
    setAEnviar(true)
    try {
      const fd = new FormData()
      fd.append('ficheiro', ficheiro)
      for (const k of ['titulo', 'autor', 'contexto']) if (f[k]) fd.append(k, f[k])
      if (guardar) fd.append('guardar', String(f.guardar))
      feito(await api(caminho, { metodo: 'POST', formulario: fd }))
      setF({ titulo: '', autor: '', contexto: '', guardar: false })
      setFicheiro(null)
      setChave((k) => k + 1)
    } catch (falha) {
      falhou(falha)
    } finally {
      setAEnviar(false)
    }
  }
  const id = caminho.replace(/\W/g, '')
  return (
    <Painel titulo={<><i className={`fa ${icone} me-2`} />{titulo}</>}>
      <form onSubmit={enviar}>
        <input key={chave} type="file" accept={ACEITAR} className="form-control mb-2" onChange={(e) => setFicheiro(e.target.files[0] || null)} aria-label="Documento (PDF ou Word)" />
        <div className="row g-2">
          <div className="col-7"><input className="form-control form-control-sm" value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} placeholder="Título" aria-label="Título" id={`${id}-t`} /></div>
          <div className="col-5"><input className="form-control form-control-sm" value={f.autor} onChange={(e) => setF({ ...f, autor: e.target.value })} placeholder="Autor" aria-label="Autor" /></div>
          {contexto && <div className="col-12"><input className="form-control form-control-sm" value={f.contexto} onChange={(e) => setF({ ...f, contexto: e.target.value })} placeholder="Coleção (ex.: TFC CEM 2023/2024)" aria-label="Coleção" /></div>}
        </div>
        {guardar && <label className="small mt-2 d-block"><input type="checkbox" checked={f.guardar} onChange={(e) => setF({ ...f, guardar: e.target.checked })} /> Guardar também no repositório</label>}
        <button type="submit" className="btn btn-sm btn-theme mt-2" disabled={aEnviar}>{aEnviar ? 'A ler o documento…' : botao}</button>
        <div className="small text-muted mt-2">{nota}</div>
      </form>
    </Painel>
  )
}

function Repositorio({ l, origens, carregar, falhou }) {
  async function apagar(doc) {
    if (!(await confirmar(`Retirar "${doc.titulo}" do repositório? Deixa de servir de comparação.`, { titulo: 'Retirar documento', botao: 'Retirar', perigo: true }))) return
    await api(`/integridade/documentos/${doc.id}`, { metodo: 'DELETE' }).then(carregar).catch(falhou)
  }
  return (
    <Painel titulo={`Fontes de referência (${l?.length ?? '…'})`} corpo={false}>
      <div className="list-group list-group-flush" style={{ maxHeight: 360, overflowY: 'auto' }}>
        {l?.length === 0 && <div className="list-group-item small text-muted">Sem documentos de referência nem obras digitais indexadas.</div>}
        {l?.map((doc) => (
          <div key={doc.id} className="list-group-item d-flex gap-2 align-items-center">
            <i className={`fa ${doc.origem === 'biblioteca' ? 'fa-book text-success' : 'fa-archive text-purple'}`} />
            <span className="flex-grow-1 min-w-0 small"><b className="d-block text-truncate">{doc.titulo}</b><span className="text-muted">{[origens[doc.origem], doc.autor, `${doc.palavras} palavras`].filter(Boolean).join(' · ')}</span></span>
            {doc.origem === 'repositorio' && <button type="button" className="btn btn-xs btn-white text-danger" onClick={() => apagar(doc)} aria-label={`Retirar ${doc.titulo}`}><i className="fa fa-times" /></button>}
          </div>
        ))}
      </div>
    </Painel>
  )
}

function VerAnalise({ id }) {
  const [r, setR] = useState(null)
  const [erro, setErro] = useState('')
  const carregar = useCallback(() => api(`/integridade/analises/${id}`).then(setR).catch((e) => setErro(e.message)), [id])
  useEffect(() => { carregar() }, [carregar])
  useEffect(() => {
    if (r?.estado !== 'pendente') return undefined
    const t = setTimeout(carregar, 2500)
    return () => clearTimeout(t)
  }, [r, carregar])
  if (erro) return <Erro texto={erro} />
  if (!r) return <Carregando />
  return (
    <>
      <CabecalhoPagina titulo="Relatório de originalidade" subtitulo={r.origens[r.documento.origem]} migalhas={[{ rotulo: 'Integridade académica', para: '/integridade' }, { rotulo: r.documento.titulo }]}>
        <Link to="/integridade" className="btn btn-white"><i className="fa fa-arrow-left me-1" />Voltar</Link>
      </CabecalhoPagina>
      <Relatorio r={r} />
    </>
  )
}

export default Integridade
