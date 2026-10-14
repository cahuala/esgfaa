import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, obterFicheiro } from '../../api'
import { Aviso, CabecalhoPagina, Carregando, Erro, Painel } from '../../componentes/Ui'
import { confirmar } from '../../../portal/dialogos'
import Capa from '../../../portal/biblioteca/Capa'
import { CampoFicheiro } from '../../componentes/Campo'
import { TAMANHOS } from '../../imagens'

const VAZIA = { capa: '', tipo: 'livro', titulo: '', subtitulo: '', autores: [], ano: '', editora: '', edicao: '', isbn: '', cota: '', assuntos: [], idioma: 'pt', resumo: '', acesso: 'todos' }
const dia = (iso) => new Date(iso).toLocaleDateString('pt-PT')

// ficha de uma obra: dados bibliográficos, versão digital e exemplares
function Obra() {
  const { id } = useParams()
  const nova = id === 'nova'
  const ir = useNavigate()
  const [meta, setMeta] = useState(null)
  const [o, setO] = useState(nova ? VAZIA : null)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState(null)
  const falhou = useCallback((e) => setAviso({ tipo: 'erro', texto: e.message }), [])
  useEffect(() => { api('/biblioteca').then(setMeta).catch((e) => setErro(e.message)) }, [])
  useEffect(() => { if (!nova) api(`/biblioteca/obras/${id}`).then(setO).catch((e) => setErro(e.message)) }, [id, nova])
  if (erro) return <Erro texto={erro} />
  if (!meta || !o) return <Carregando />

  async function apagar() {
    if (!(await confirmar(`Apagar "${o.titulo}" do catálogo, com os ${o.exemplares.length} exemplar(es) e o histórico de empréstimos?`, { titulo: 'Apagar obra', botao: 'Apagar', perigo: true }))) return
    await api(`/biblioteca/obras/${o.id}`, { metodo: 'DELETE' }).then(() => ir('/biblioteca')).catch(falhou)
  }

  return (
    <>
      <CabecalhoPagina titulo={nova ? 'Nova obra' : o.titulo} subtitulo={nova ? '' : meta.tipos[o.tipo]} migalhas={[{ rotulo: 'Biblioteca', para: '/biblioteca' }, { rotulo: nova ? 'Nova obra' : o.titulo }]}>
        {!nova && <button type="button" className="btn btn-white text-danger" onClick={apagar}><i className="fa fa-trash-alt me-1" />Apagar</button>}
      </CabecalhoPagina>
      <div className="row">
        <div className={nova ? 'col-xl-9' : 'col-xl-7'}>
          <Formulario o={o} meta={meta} nova={nova} feito={(g) => { setAviso({ texto: 'Obra guardada.' }); if (nova) ir(`/biblioteca/obras/${g.id}`, { replace: true }); else setO(g) }} falhou={falhou} />
        </div>
        {!nova && <div className="col-xl-5"><Exemplares o={o} meta={meta} setO={setO} falhou={falhou} /></div>}
      </div>
      <Aviso aviso={aviso} onFechar={() => setAviso(null)} />
    </>
  )
}

function Formulario({ o, meta, nova, feito, falhou }) {
  const [f, setF] = useState(() => ({ ...o, autores: o.autores.join('\n'), assuntos: o.assuntos.join('; '), ano: o.ano ?? '', isbn: o.isbn ?? '' }))
  const [pdf, setPdf] = useState(null)
  const [remover, setRemover] = useState(false)
  const [aGuardar, setAGuardar] = useState(false)
  const campo = (k) => ({ id: `o-${k}`, value: f[k], onChange: (e) => setF({ ...f, [k]: e.target.value }) })
  async function guardar(e) {
    e.preventDefault()
    setAGuardar(true)
    try {
      const fd = new FormData()
      for (const k of ['capa', 'tipo', 'titulo', 'subtitulo', 'autores', 'ano', 'editora', 'edicao', 'isbn', 'cota', 'assuntos', 'idioma', 'resumo', 'acesso']) fd.append(k, f[k] ?? '')
      if (pdf) fd.append('ficheiro', pdf)
      else if (remover) fd.append('removerDigital', 'true')
      const g = await api(nova ? '/biblioteca/obras' : `/biblioteca/obras/${o.id}`, { metodo: nova ? 'POST' : 'PUT', formulario: fd })
      setPdf(null)
      setRemover(false)
      feito(g)
    } catch (falha) {
      falhou(falha)
    } finally {
      setAGuardar(false)
    }
  }
  return (
    <Painel titulo="Dados da obra">
      <form onSubmit={guardar}>
        <div className="row g-2">
          <div className="col-md-4"><label className="form-label" htmlFor="o-tipo">Tipo</label><select className="form-select" {...campo('tipo')}>{Object.entries(meta.tipos).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div className="col-md-8"><label className="form-label fw-bold" htmlFor="o-titulo">Título</label><input className="form-control" {...campo('titulo')} required /></div>
          <div className="col-12"><label className="form-label" htmlFor="o-subtitulo">Subtítulo</label><input className="form-control" {...campo('subtitulo')} /></div>
          <div className="col-md-6"><label className="form-label" htmlFor="o-autores">Autores <span className="text-muted small">(um por linha)</span></label><textarea className="form-control" rows={3} {...campo('autores')} /></div>
          <div className="col-md-6"><label className="form-label" htmlFor="o-assuntos">Assuntos <span className="text-muted small">(separados por ;)</span></label><textarea className="form-control" rows={3} {...campo('assuntos')} /></div>
          <div className="col-md-5"><label className="form-label" htmlFor="o-editora">Editora</label><input className="form-control" {...campo('editora')} /></div>
          <div className="col-md-2"><label className="form-label" htmlFor="o-ano">Ano</label><input className="form-control" inputMode="numeric" {...campo('ano')} /></div>
          <div className="col-md-2"><label className="form-label" htmlFor="o-edicao">Edição</label><input className="form-control" {...campo('edicao')} placeholder="2.ª" /></div>
          <div className="col-md-3"><label className="form-label" htmlFor="o-idioma">Idioma</label><select className="form-select" {...campo('idioma')}>{Object.entries(meta.idiomas).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div className="col-md-6"><label className="form-label" htmlFor="o-isbn">ISBN</label><input className="form-control" {...campo('isbn')} placeholder="978-…" /></div>
          <div className="col-md-6"><label className="form-label" htmlFor="o-cota">Cota <span className="text-muted small">(CDU e lugar na estante)</span></label><input className="form-control" {...campo('cota')} placeholder="355.01 CLA" /></div>
          <div className="col-12"><label className="form-label" htmlFor="o-resumo">Resumo</label><textarea className="form-control" rows={4} {...campo('resumo')} /></div>
        </div>
        <fieldset className="border rounded p-2 mt-3">
          <legend className="fs-13px fw-bold float-none w-auto px-1 mb-0">Capa</legend>
          <div className="d-flex gap-3 align-items-start">
            <div style={{ width: 96, flex: '0 0 96px' }}><Capa o={{ ...f, id: o.id ?? 0, autores: f.autores.split('\n').filter(Boolean), titulo: f.titulo || 'Título' }} /></div>
            <div className="flex-grow-1">
              <CampoFicheiro id="o-capa" tipo="imagem" valor={f.capa} onChange={(capa) => setF({ ...f, capa })} recomendado={TAMANHOS.livro} />
              <div className="small text-muted mt-1">Fotografia ou digitalização da capa (JPG, PNG ou WebP, vertical). Sem imagem, o portal desenha uma capa com o título e o autor.</div>
            </div>
          </div>
        </fieldset>
        <fieldset className="border rounded p-2 mt-3">
          <legend className="fs-13px fw-bold float-none w-auto px-1 mb-0">Versão digital (PDF)</legend>
          {o.ficheiro && !remover && (
            <div className="d-flex align-items-center gap-2 mb-2">
              <i className="fa fa-file-pdf text-danger" />
              <button type="button" className="btn btn-link p-0" onClick={() => obterFicheiro(`/biblioteca/obras/${o.id}/digital?ver=1`, o.ficheiro.nome, { abrir: true }).catch(falhou)}>{o.ficheiro.nome}</button>
              <span className="small text-muted">{Math.round(o.ficheiro.tamanho / 1024)} KB</span>
              <button type="button" className="btn btn-xs btn-white text-danger ms-auto" onClick={() => setRemover(true)}>Retirar</button>
            </div>
          )}
          {remover && <div className="small text-danger mb-2">A versão digital será retirada ao guardar. <button type="button" className="btn btn-link btn-sm p-0" onClick={() => setRemover(false)}>Desfazer</button></div>}
          <div className="row g-2">
            <div className="col-md-7"><input type="file" accept="application/pdf" className="form-control" onChange={(e) => setPdf(e.target.files[0] || null)} aria-label="Ficheiro PDF" /></div>
            <div className="col-md-5"><select className="form-select" {...campo('acesso')} aria-label="Quem pode ler">{Object.entries(meta.acessos).map(([k, v]) => <option key={k} value={k}>Lêem: {v}</option>)}</select></div>
          </div>
        </fieldset>
        <div className="mt-3 d-flex gap-2">
          <button type="submit" className="btn btn-theme" disabled={aGuardar}>{aGuardar ? 'A guardar…' : 'Guardar'}</button>
          {nova && <Link to="/biblioteca" className="btn btn-white">Cancelar</Link>}
        </div>
      </form>
    </Painel>
  )
}

function Exemplares({ o, meta, setO, falhou }) {
  const [n, setN] = useState({ quantidade: 1, localizacao: '', codigo: '' })
  const [aCriar, setACriar] = useState(false)
  async function adicionar(e) {
    e.preventDefault()
    setACriar(true)
    try {
      setO(await api(`/biblioteca/obras/${o.id}/exemplares`, { metodo: 'POST', corpo: { quantidade: Number(n.quantidade), localizacao: n.localizacao, ...(n.codigo ? { codigo: n.codigo } : {}) } }))
      setN({ ...n, codigo: '' })
    } catch (falha) {
      falhou(falha)
    } finally {
      setACriar(false)
    }
  }
  const mudar = (x, corpo) => api(`/biblioteca/exemplares/${x.id}`, { metodo: 'PUT', corpo }).then(setO).catch(falhou)
  async function apagar(x) {
    if (!(await confirmar(`Apagar o exemplar ${x.codigo}? Para um livro que saiu do acervo, prefira o estado "Abatido".`, { titulo: 'Apagar exemplar', botao: 'Apagar', perigo: true }))) return
    await api(`/biblioteca/exemplares/${x.id}`, { metodo: 'DELETE' }).then(setO).catch(falhou)
  }
  return (
    <Painel titulo={`Exemplares (${o.exemplares.length})`} corpo={false}>
      <div className="list-group list-group-flush">
        {o.exemplares.length === 0 && <div className="list-group-item text-muted small">Sem exemplares físicos{o.ficheiro ? ' (só digital)' : ''}.</div>}
        {o.exemplares.map((x) => (
          <div key={x.id} className="list-group-item">
            <div className="d-flex align-items-center gap-2">
              <b className="font-monospace">{x.codigo}</b>
              <select className="form-select form-select-sm w-auto" value={x.estado} onChange={(e) => mudar(x, { estado: e.target.value })} aria-label={`Estado de ${x.codigo}`}>{Object.entries(meta.estados).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
              <span className="ms-auto">
                {x.emprestimo
                  ? <span className={`badge ${new Date(x.emprestimo.prazo) < new Date() ? 'bg-danger' : 'bg-info'}`}>Emprestado até {dia(x.emprestimo.prazo)}</span>
                  : <span className="badge bg-success">Na estante</span>}
              </span>
              <button type="button" className="btn btn-xs btn-white text-danger" onClick={() => apagar(x)} aria-label={`Apagar ${x.codigo}`}><i className="fa fa-trash-alt" /></button>
            </div>
            <div className="small text-muted mt-1">
              {x.localizacao || 'Sem localização'}
              {x.emprestimo && <> · com <b>{x.emprestimo.leitor.nome}</b> ({x.emprestimo.leitor.numero})</>}
            </div>
          </div>
        ))}
      </div>
      <form className="panel-body border-top" onSubmit={adicionar}>
        <div className="row g-2 align-items-end">
          <div className="col-3"><label className="form-label small" htmlFor="x-qtd">Quantos</label><input id="x-qtd" type="number" min={1} max={50} className="form-control form-control-sm" value={n.quantidade} onChange={(e) => setN({ ...n, quantidade: e.target.value, codigo: '' })} /></div>
          <div className="col-5"><label className="form-label small" htmlFor="x-loc">Localização</label><input id="x-loc" className="form-control form-control-sm" value={n.localizacao} onChange={(e) => setN({ ...n, localizacao: e.target.value })} placeholder="Sala 1, estante 3" /></div>
          <div className="col-4"><label className="form-label small" htmlFor="x-cod">Código</label><input id="x-cod" className="form-control form-control-sm" value={n.codigo} onChange={(e) => setN({ ...n, codigo: e.target.value, quantidade: 1 })} placeholder="automático" /></div>
        </div>
        <button type="submit" className="btn btn-sm btn-theme mt-2" disabled={aCriar}><i className="fa fa-plus me-1" />{aCriar ? 'A registar…' : 'Registar exemplar(es)'}</button>
      </form>
    </Painel>
  )
}

export default Obra
