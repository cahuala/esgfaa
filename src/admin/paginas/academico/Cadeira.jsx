import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { abrirFicheiro, api } from '../../api'
import { useSessao } from '../../sessaoContexto'
import { Aviso, CabecalhoPagina, Carregando, Erro, Painel } from '../../componentes/Ui'
import EditorTexto from '../../editor/EditorTexto'
import { PAPEIS_DOCENCIA, PERIODOS } from './comum'
import PautaAdmin from './PautaAdmin'
import Inscricoes from './Inscricoes'
import { t as tx } from '../../../i18n/linguas'

const SEPARADORES = [
  ['dados', 'fa-info-circle', tx('Dados')],
  ['docentes', 'fa-chalkboard-teacher', tx('Docentes')],
  ['programa', 'fa-book-open', tx('Programa')],
  ['pauta', 'fa-table', tx('Pauta')],
  ['estudantes', 'fa-users', tx('Estudantes e inscrições')],
]

// ficha de uma cadeira na Administração Escolar: dados e período, alocação de docentes, programa e pauta
function Cadeira() {
  const { id } = useParams()
  const { pode } = useSessao()
  const gerir = pode('academico.gerir')
  const [params, setParams] = useSearchParams()
  const separador = SEPARADORES.some(([k]) => k === params.get('separador')) ? params.get('separador') : 'dados'
  const [c, setC] = useState(null)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState(null)

  const carregar = useCallback(() => api(`/academico/cadeiras/${id}`).then((r) => { setErro(''); setC(r) }).catch((e) => setErro(e.message)), [id])
  useEffect(() => { carregar() }, [carregar])

  if (erro) return <Erro texto={erro} />
  if (!c) return <Carregando />
  const props = { c, gerir, recarregar: carregar, avisar: setAviso }

  return (
    <>
      <CabecalhoPagina
        titulo={`${c.codigo} · ${c.nome}`}
        subtitulo={`${c.turma.nome} · ${PERIODOS[c.periodo]} · ${c.horas} h`}
        migalhas={[{ rotulo: tx('Turmas'), para: '/academico/turmas' }, { rotulo: c.turma.nome, para: `/academico/turmas/${c.turma.id}` }, { rotulo: c.codigo }]}
      >
        <Link to={`/academico/turmas/${c.turma.id}`} className="btn btn-white"><i className="fa fa-arrow-left me-1" /> {tx('Turma')}</Link>
      </CabecalhoPagina>

      <ul className="nav nav-tabs" role="tablist">
        {SEPARADORES.map(([k, icone, texto]) => (
          <li key={k} className="nav-item">
            <button type="button" role="tab" aria-selected={separador === k} className={`nav-link ${separador === k ? 'active' : ''}`} onClick={() => setParams({ separador: k }, { replace: true })}>
              <i className={`fa ${icone} me-1`} /> {texto}
              {k === 'docentes' && <span className={`badge ms-1 ${c.docentes.length ? 'bg-gray-500' : 'bg-warning text-dark'}`}>{c.docentes.length}</span>}
            </button>
          </li>
        ))}
      </ul>
      <div className="tab-content panel rounded-0 rounded-bottom p-3 mb-4">
        {separador === 'dados' && <><Dados {...props} />{gerir && <div className="mt-4" style={{ maxWidth: 820 }}><CopiarConteudos {...props} /></div>}</>}
        {separador === 'docentes' && <Docentes {...props} />}
        {separador === 'programa' && <Programa {...props} />}
        {separador === 'pauta' && <PautaAdmin cadeira={c} avisar={setAviso} />}
        {separador === 'estudantes' && <Inscricoes c={c} gerir={gerir} avisar={setAviso} />}
      </div>
      <Aviso aviso={aviso} onFechar={() => setAviso(null)} />
    </>
  )
}

// copiar os conteúdos de uma cadeira de outro ano (ou de outra turma) para esta
function CopiarConteudos({ c, recarregar, avisar }) {
  const [origens, setOrigens] = useState(null)
  const [origem, setOrigem] = useState('')
  const [docentes, setDocentes] = useState(false)
  const [aCopiar, setACopiar] = useState(false)
  useEffect(() => {
    api('/academico/origens-copia').then((l) => {
      const outras = l.filter((x) => x.id !== c.id)
      setOrigens(outras)
      setOrigem(String(outras.find((x) => x.codigo === c.codigo)?.id || ''))
    }).catch(() => setOrigens([]))
  }, [c.id, c.codigo])
  async function copiar() {
    setACopiar(true)
    try {
      const r = await api(`/academico/cadeiras/${c.id}/copiar`, { metodo: 'POST', corpo: { origemId: Number(origem), docentes } })
      avisar({ texto: tx('Copiados: {0} capítulos, {1} materiais, {2} trabalhos, {3} questionários, {4} datas.', { 0: r.capitulos, 1: r.materiais, 2: r.trabalhos, 3: r.questionarios, 4: r.datas }) })
      recarregar()
    } catch (e) {
      avisar({ tipo: 'erro', texto: e.message })
    } finally {
      setACopiar(false)
    }
  }
  if (!origens) return null
  return (
    <Painel titulo={tx('Copiar conteúdos de outra cadeira')}>
      <p className="small text-muted">{tx('Capítulos, materiais e ficheiros, trabalhos, questionários, datas, programa e composição das notas. As datas avançam os anos que separam os anos letivos.')}</p>
      <div className="d-flex gap-2 flex-wrap align-items-center">
        <select className="form-select w-auto" value={origem} onChange={(e) => setOrigem(e.target.value)} aria-label={tx('Cadeira de origem')}>
          <option value="">{tx('Escolha a cadeira…')}</option>
          {origens.map((x) => <option key={x.id} value={x.id}>{x.codigo} · {x.nome} — {x.turma?.nome}</option>)}
        </select>
        <div className="form-check mb-0">
          <input id="cc-docentes" type="checkbox" className="form-check-input" checked={docentes} onChange={(e) => setDocentes(e.target.checked)} />
          <label className="form-check-label" htmlFor="cc-docentes">{tx('e os docentes')}</label>
        </div>
        <button type="button" className="btn btn-theme" disabled={!origem || aCopiar} onClick={copiar}><i className="fa fa-copy me-1" />{aCopiar ? tx('A copiar…') : tx('Copiar')}</button>
      </div>
    </Painel>
  )
}

function Dados({ c, gerir, recarregar, avisar }) {
  const [f, setF] = useState({ codigo: c.codigo, nome: c.nome, periodo: c.periodo, horas: c.horas, descricao: c.descricao })
  const [erro, setErro] = useState('')
  async function guardar(e) {
    e.preventDefault()
    setErro('')
    try {
      await api(`/academico/cadeiras/${c.id}`, { metodo: 'PUT', corpo: { ...f, horas: Number(f.horas || 0) } })
      avisar({ texto: tx('Cadeira guardada.') })
      recarregar()
    } catch (falha) {
      setErro(falha.message)
    }
  }
  return (
    <form onSubmit={guardar} style={{ maxWidth: 820 }}>
      {erro && <div className="alert alert-danger py-2">{erro}</div>}
      <fieldset disabled={!gerir} className="row g-3">
        <div className="col-md-3"><label className="form-label fw-bold" htmlFor="d-codigo">{tx('Código')}</label><input id="d-codigo" className="form-control" value={f.codigo} onChange={(e) => setF({ ...f, codigo: e.target.value })} required /></div>
        <div className="col-md-9"><label className="form-label fw-bold" htmlFor="d-nome">{tx('Nome')}</label><input id="d-nome" className="form-control" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} required /></div>
        <div className="col-md-6">
          <span className="form-label fw-bold d-block">{tx('Período')}</span>
          <div className="btn-group w-100" role="group" aria-label={tx('Período')}>
            {Object.entries(PERIODOS).map(([k, v]) => (
              <button key={k} type="button" className={`btn ${f.periodo === k ? 'btn-primary' : 'btn-white'}`} aria-pressed={f.periodo === k} onClick={() => setF({ ...f, periodo: k })}>{v}</button>
            ))}
          </div>
        </div>
        <div className="col-md-6"><label className="form-label fw-bold" htmlFor="d-horas">{tx('Carga horária total (h)')}</label><input id="d-horas" type="number" min={0} className="form-control" value={f.horas} onChange={(e) => setF({ ...f, horas: e.target.value })} /></div>
        <div className="col-12"><label className="form-label fw-bold" htmlFor="d-desc">{tx('Descrição curta')}</label><textarea id="d-desc" rows={3} className="form-control" value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} /></div>
        {gerir && <div className="col-12"><button type="submit" className="btn btn-theme"><i className="fa fa-save me-1" /> {tx('Guardar')}</button></div>}
      </fieldset>
    </form>
  )
}

// regente + assistentes, com as horas de cada um
function Docentes({ c, gerir, recarregar, avisar }) {
  const [todos, setTodos] = useState([])
  const [linhas, setLinhas] = useState(c.docentes.map((d) => ({ docenteId: String(d.id), papel: d.papel, horas: String(d.horas) })))
  const [erro, setErro] = useState('')
  useEffect(() => { api('/academico/contas?tipo=docente').then((l) => setTodos(l.filter((d) => d.ativo))).catch(() => {}) }, [])

  const mudar = (i, k, v) => setLinhas(linhas.map((l, j) => (i === j ? { ...l, [k]: v } : l)))
  const horas = linhas.reduce((s, l) => s + Number(l.horas || 0), 0)
  const temRegente = linhas.some((l) => l.papel === 'regente')

  async function guardar() {
    setErro('')
    try {
      await api(`/academico/cadeiras/${c.id}/docentes`, { metodo: 'PUT', corpo: { docentes: linhas.filter((l) => l.docenteId).map((l) => ({ docenteId: Number(l.docenteId), papel: l.papel, horas: Number(l.horas || 0) })) } })
      avisar({ texto: tx('Alocação guardada. Os docentes já veem a cadeira no portal.') })
      recarregar()
    } catch (falha) {
      setErro(falha.message)
    }
  }

  return (
    <div style={{ maxWidth: 900 }}>
      {erro && <div className="alert alert-danger py-2">{erro}</div>}
      {!temRegente && <div className="alert alert-warning py-2"><i className="fa fa-exclamation-triangle me-1" /> {tx('A cadeira ainda não tem regente.')}</div>}
      <table className="table align-middle">
        <thead><tr><th>{tx('Docente')}</th><th style={{ width: 170 }}>{tx('Papel')}</th><th style={{ width: 130 }}>{tx('Horas')}</th><th style={{ width: 50 }} /></tr></thead>
        <tbody>
          {linhas.length === 0 && <tr><td colSpan={4} className="text-muted text-center py-3">{tx('Sem docentes alocados.')}</td></tr>}
          {linhas.map((l, i) => (
            <tr key={i}>
              <td>
                <select className="form-select" value={l.docenteId} disabled={!gerir} aria-label={tx('Docente {0}', { 0: i + 1 })} onChange={(e) => mudar(i, 'docenteId', e.target.value)}>
                  <option value="">{tx('Escolha…')}</option>
                  {todos.map((d) => <option key={d.id} value={d.id} disabled={linhas.some((x, j) => j !== i && x.docenteId === String(d.id))}>{d.nome} ({d.numero})</option>)}
                </select>
              </td>
              <td>
                <select className="form-select" value={l.papel} disabled={!gerir} aria-label={tx('Papel do docente {0}', { 0: i + 1 })} onChange={(e) => mudar(i, 'papel', e.target.value)}>
                  {Object.entries(PAPEIS_DOCENCIA).map(([k, v]) => <option key={k} value={k} disabled={k === 'regente' && linhas.some((x, j) => j !== i && x.papel === 'regente')}>{v}</option>)}
                </select>
              </td>
              <td><input type="number" min={0} className="form-control" value={l.horas} disabled={!gerir} aria-label={tx('Horas do docente {0}', { 0: i + 1 })} onChange={(e) => mudar(i, 'horas', e.target.value)} /></td>
              <td>{gerir && <button type="button" className="btn btn-white text-danger" aria-label={tx('Retirar docente')} onClick={() => setLinhas(linhas.filter((_, j) => j !== i))}><i className="fa fa-times" /></button>}</td>
            </tr>
          ))}
        </tbody>
        <tfoot><tr><th colSpan={2} className="text-end">{tx('Horas alocadas')}</th><th className={horas > c.horas ? 'text-danger' : ''}>{horas} / {c.horas} {tx('h')}</th><th /></tr></tfoot>
      </table>
      {gerir && (
        <div className="d-flex gap-2">
          <button type="button" className="btn btn-white" onClick={() => setLinhas([...linhas, { docenteId: '', papel: temRegente ? 'assistente' : 'regente', horas: '' }])}><i className="fa fa-plus me-1" /> {tx('Adicionar docente')}</button>
          <button type="button" className="btn btn-theme" onClick={guardar}><i className="fa fa-save me-1" /> {tx('Guardar alocação')}</button>
        </div>
      )}
      <p className="small text-muted mt-3 mb-0">{tx('O regente e os assistentes veem a cadeira no portal: publicam materiais, avisos e trabalhos, registam aulas e lançam a pauta.')}</p>
    </div>
  )
}

// programa escrito no próprio site e/ou em documento (PDF, Word)
function Programa({ c, gerir, recarregar, avisar }) {
  const [html, setHtml] = useState(c.programa)
  const [aGuardar, setAGuardar] = useState(false)
  const falhou = (e) => avisar({ tipo: 'erro', texto: e.message })

  async function guardarTexto() {
    setAGuardar(true)
    await api(`/academico/cadeiras/${c.id}/programa`, { metodo: 'PUT', corpo: { texto: html } })
      .then(() => { avisar({ texto: tx('Programa guardado.') }); recarregar() }).catch(falhou)
    setAGuardar(false)
  }

  async function enviar(e) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    const dados = new FormData()
    dados.append('ficheiro', f)
    await api(`/academico/cadeiras/${c.id}/programa`, { metodo: 'PUT', formulario: dados })
      .then(() => { avisar({ texto: tx('Documento do programa enviado.') }); recarregar() }).catch(falhou)
  }

  return (
    <div className="row g-4">
      <div className="col-xl-8">
        <h5 className="mb-2">{tx('Programa escrito no portal')}</h5>
        <div className="border rounded">
          <EditorTexto html={html} onChange={setHtml} aoErro={(t) => avisar({ tipo: 'erro', texto: t })} editavel={gerir} placeholder={tx('Objetivos, conteúdos, avaliação, bibliografia…')} />
        </div>
        {gerir && <button type="button" className="btn btn-theme mt-2" onClick={guardarTexto} disabled={aGuardar}><i className="fa fa-save me-1" /> {aGuardar ? tx('A guardar…') : tx('Guardar programa')}</button>}
      </div>
      <div className="col-xl-4">
        <Painel titulo={tx('Programa em documento')}>
          {c.programaFicheiro ? (
            <div className="d-flex align-items-center gap-2 mb-3">
              <i className="fa fa-file-alt fa-2x text-muted" />
              <div className="flex-grow-1 text-truncate">
                <button type="button" className="btn btn-link p-0 text-start" onClick={() => abrirFicheiro(c.programaFicheiro.id, c.programaFicheiro.nome).catch(falhou)}>{c.programaFicheiro.nome}</button>
                <div className="small text-muted">{Math.max(1, Math.round(c.programaFicheiro.tamanho / 1024))} {tx('KB')}</div>
              </div>
              {gerir && <button type="button" className="btn btn-xs btn-white text-danger" aria-label={tx('Retirar documento')} onClick={() => api(`/academico/cadeiras/${c.id}/programa`, { metodo: 'PUT', corpo: { removerFicheiro: true } }).then(recarregar).catch(falhou)}><i className="fa fa-times" /></button>}
            </div>
          ) : <p className="text-muted">{tx('Sem documento.')}</p>}
          {gerir && (
            <label className="btn btn-white w-100 mb-0">
              <i className="fa fa-upload me-1" /> {c.programaFicheiro ? tx('Substituir documento') : tx('Enviar documento')}
              <input type="file" className="d-none" accept=".pdf,.doc,.docx" onChange={enviar} />
            </label>
          )}
          <p className="small text-muted mt-2 mb-0">{tx('PDF ou Word. Os estudantes e docentes da cadeira descarregam-no no portal.')}</p>
        </Painel>
      </div>
    </div>
  )
}

export default Cadeira
