import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { useSessao } from '../sessao'
import { useDados } from '../useDados'
import { ICONE_UNIDADE } from '../arvore'
import { documentoExcel, documentoPdf } from '../exportar'
import Foto from '../componentes/Foto'
import Tabela from '../componentes/Tabela'
import { Cabecalho, Campo, Carregando, Erro, Escolha, Modal, Painel } from '../componentes/Ui'

const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0)
const corPct = (p) => (p >= 80 ? '#2e7d32' : p >= 50 ? '#e65100' : '#c62828')
const COR_TIPO = { comando: ['#fff8e1', '#ff8f00'], batalhao: ['#efebe9', '#5d4037'], pelotao: ['#f3e5f5', '#8e24aa'], direccao: ['#ede7f6', '#5e35b1'], gabinete: ['#e8eaf6', '#3949ab'], departamento: ['#e3f2fd', '#1565c0'], reparticao: ['#e0f2f1', '#00796b'], seccao: ['#f1f8e9', '#558b2f'], servico: ['#fff3e0', '#e65100'], companhia: ['#fbe9e7', '#bf360c'], curso: ['#fce4ec', '#ad1457'], outro: ['#eceff1', '#546e7a'] }
const procurar = (n, id) => (n.id === id ? n : n.filhos.reduce((r, f) => r ?? procurar(f, id), null))
const caminhoAte = (n, id, c = []) => (n.id === id ? [...c, n] : n.filhos.reduce((r, f) => r ?? caminhoAte(f, id, [...c, n]), null))
const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function BadgeTipo({ n }) {
  const [bg, fg] = COR_TIPO[n.tipo] ?? COR_TIPO.outro
  return n.tipoNome ? <span className="pes-org-tipo" style={{ background: bg, color: fg }}>{n.tipoNome}</span> : null
}

// números de uma unidade (com as subunidades): cargos (lugares), ocupados, vagos e a barra de preenchimento
function Numeros({ n }) {
  const vagos = Math.max(0, n.lugares - n.ocupados)
  const p = pct(n.ocupados, n.lugares)
  if (!n.lugares) return <span className="pes-org-stats text-muted small">Sem cargos</span>
  return (
    <span className="pes-org-stats">
      <span title="Lugares (cargos × efectivo previsto)"><i className="fa fa-briefcase text-muted" /> {n.lugares}</span>
      <span className="text-success" title="Ocupados"><i className="fa fa-user-check" /> {n.ocupados}</span>
      {vagos > 0 && <span className="text-danger" title="Vagos"><i className="fa fa-user-times" /> {vagos}</span>}
      <span className="pes-org-barra" title={`${p}% preenchido`}><span style={{ width: `${p}%`, background: corPct(p) }} /></span>
      <b style={{ color: corPct(p), fontSize: 11, minWidth: 30 }}>{p}%</b>
    </span>
  )
}

// linha do organograma (como uma árvore de pastas): abre e fecha as subunidades
function Linha({ n, nivel, abertos, alternar, gerir, aoAcao, filtro }) {
  const aberto = filtro ? true : abertos.has(n.id)
  const filhos = filtro ? n.filhos.filter((f) => filtro.has(f.id)) : n.filhos
  return (
    <div className="pes-org-linha">
      <div className="pes-org-interior" style={{ paddingLeft: 12 + nivel * 22 }}>
        <button type="button" className="pes-org-seta" onClick={() => n.filhos.length && alternar(n.id)} aria-label={n.filhos.length ? (aberto ? 'Recolher' : 'Expandir') : undefined} disabled={!n.filhos.length}>
          {n.filhos.length ? <i className={`fa fa-chevron-right ${aberto ? 'aberta' : ''}`} /> : <i className="fa fa-circle" style={{ fontSize: 5, opacity: 0.4 }} />}
        </button>
        <i className={`fa fa-fw ${ICONE_UNIDADE[n.tipo] ?? 'fa-building'} text-muted`} />
        <span className="pes-org-nome">
          <Link to={`/organica/${n.id}`}>{n.nome}</Link>
          {n.sigla && <span className="pes-org-sigla">{n.sigla}</span>}
          <BadgeTipo n={n} />
          {n.filhos.length > 0 && <span className="small text-muted">{n.filhos.length} subunidade(s)</span>}
        </span>
        <Numeros n={n} />
        {gerir && (
          <span className="pes-org-accoes">
            <button type="button" title="Adicionar subunidade" onClick={() => aoAcao('nova', n)}><i className="fa fa-plus text-success" /></button>
            <button type="button" title="Adicionar cargo" onClick={() => aoAcao('cargo', n)}><i className="fa fa-chair text-primary" /></button>
            <button type="button" title="Editar" onClick={() => aoAcao('editar', n)}><i className="fa fa-pencil-alt text-primary" /></button>
            <button type="button" title="Apagar" onClick={() => aoAcao('apagar', n)}><i className="fa fa-trash text-danger" /></button>
          </span>
        )}
      </div>
      {aberto && filhos.length > 0 && <div className="pes-org-filhos">{filhos.map((f) => <Linha key={f.id} n={f} nivel={nivel + 1} abertos={abertos} alternar={alternar} gerir={gerir} aoAcao={aoAcao} filtro={filtro} />)}</div>}
    </div>
  )
}

export default function Organica() {
  const { id } = useParams()
  const atualId = id ? Number(id) : null
  const { ref, pode, avisar } = useSessao()
  const navegar = useNavigate()
  const { dados: arvore, erro, recarregar } = useDados('/organica')
  const detalhe = useDados(atualId ? `/organica/${atualId}` : null)
  const [abertos, setAbertos] = useState(() => new Set())
  const [modal, setModal] = useState(null)
  const [pesquisa, setPesquisa] = useState('')
  const [verMapa, setVerMapa] = useState(false)
  const gerir = pode('administrar')

  const todas = useMemo(() => {
    const l = []
    const andar = (n, nivel) => { if (n.id) l.push({ ...n, nivel }); n.filhos.forEach((f) => andar(f, nivel + 1)) }
    if (arvore) andar(arvore.escola, 0)
    return l
  }, [arvore])
  const unidades = useMemo(() => todas.map((u) => ({ id: u.id, nome: `${'  '.repeat(u.nivel - 1)}${u.nivel > 1 ? '└ ' : ''}${u.nome}`, paiId: u.paiId })), [todas])
  // pesquisa: mostra as unidades que correspondem e o caminho até elas
  const filtro = useMemo(() => {
    const t = norm(pesquisa).trim()
    if (!t || !arvore) return null
    const ver = new Set()
    const marcar = (n, cam) => {
      const c = n.id ? [...cam, n.id] : cam
      if (n.id && norm(`${n.nome} ${n.sigla}`).includes(t)) c.forEach((x) => ver.add(x))
      n.filhos.forEach((f) => marcar(f, c))
    }
    marcar(arvore.escola, [])
    return ver
  }, [pesquisa, arvore])

  const alternar = (k) => setAbertos((a) => { const n = new Set(a); if (n.has(k)) n.delete(k); else n.add(k); return n })
  const depois = (m) => { setModal(null); avisar(m); recarregar(); detalhe.recarregar() }
  const aoAcao = (acao, n) => {
    if (acao === 'nova') setModal({ unidade: { paiId: n.id } })
    if (acao === 'cargo') setModal({ cargo: { unidadeId: n.id } })
    if (acao === 'editar') setModal({ unidade: n })
    if (acao === 'apagar' && window.confirm(`Apagar «${n.nome}»?`)) api(`/unidades/${n.id}`, { metodo: 'DELETE' }).then(() => depois('Unidade apagada.')).catch((e) => avisar(e.message, 'erro'))
  }

  if (erro) return <Erro texto={erro} aoRepetir={recarregar} />
  if (!arvore) return <Carregando />
  const escola = arvore.escola
  const formularios = (
    <>
      {modal?.unidade && <FormUnidade u={modal.unidade} unidades={unidades} aoFechar={() => setModal(null)} aoGuardar={depois} />}
      {modal?.imprimir && <ImprimirCargos escola={escola} inicial={modal.imprimir.id} aoFechar={() => setModal(null)} />}
      {modal?.cargo && <FormCargo c={modal.cargo} unidades={unidades} refs={ref} aoFechar={() => setModal(null)} aoGuardar={depois} />}
    </>
  )

  // ---------- detalhe de uma unidade ----------
  if (atualId) {
    const no = procurar(escola, atualId)
    if (!no) return <Erro texto="Unidade não encontrada." />
    const caminho = caminhoAte(escola, atualId).slice(1)
    const d = detalhe.dados
    const vagos = Math.max(0, no.lugares - no.ocupados)
    return (
      <>
        <Cabecalho titulo={no.nome} subtitulo={no.sigla} migalhas={[['Orgânica', '/organica'], ...caminho.slice(0, -1).map((c) => [c.sigla || c.nome, `/organica/${c.id}`]), [no.sigla || no.nome]]}>
          <button type="button" className="btn btn-outline-secondary" onClick={() => navegar(no.paiId ? `/organica/${no.paiId}` : '/organica')}><i className="fa fa-arrow-left me-1" />Voltar</button>
          <button type="button" className="btn btn-outline-secondary" onClick={() => navegar(`/pessoas?unidadeId=${atualId}`)}><i className="fa fa-users me-1" />Ver o pessoal</button>
          <button type="button" className="btn btn-outline-secondary" onClick={() => setModal({ imprimir: no })}><i className="fa fa-print me-1" />Imprimir cargos</button>
          {gerir && <button type="button" className="btn btn-outline-theme" onClick={() => setModal({ unidade: { paiId: atualId } })}><i className="fa fa-plus me-1" />Subunidade</button>}
          {gerir && <button type="button" className="btn btn-theme" onClick={() => setModal({ cargo: { unidadeId: atualId } })}><i className="fa fa-plus me-1" />Cargo</button>}
        </Cabecalho>
        <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
          <BadgeTipo n={no} />
          {caminho.length > 1 && <span className="small text-muted"><i className="fa fa-level-up-alt fa-rotate-90 me-1" />{caminho[caminho.length - 2].nome}</span>}
          {gerir && <button type="button" className="btn btn-xs btn-outline-secondary ms-auto" onClick={() => setModal({ unidade: d ?? no })}><i className="fa fa-pencil-alt me-1" />Editar unidade</button>}
        </div>
        <div className="pes-org-kpis mb-3">
          {[['fa-briefcase', 'Lugares', no.lugares, '#1565c0'], ['fa-user-check', 'Ocupados', no.ocupados, '#2e7d32'], ['fa-user-times', 'Vagos', vagos, '#c62828'], ['fa-users', 'Efectivo', no.pessoas, '#5e35b1'], ['fa-percentage', 'Preenchimento', `${pct(no.ocupados, no.lugares)}%`, corPct(pct(no.ocupados, no.lugares))]].map(([ic, t, v, cor]) => (
            <div key={t} className="pes-org-kpi"><span className="pes-org-kpi-ic" style={{ background: `${cor}18`, color: cor }}><i className={`fa ${ic}`} /></span><span><b>{v}</b><small>{t}</small></span></div>
          ))}
        </div>
        {no.filhos.length > 0 && (
          <Painel titulo={`Subunidades (${no.filhos.length})`} icone="fa-sitemap">
            <div className="d-flex flex-wrap gap-2">
              {no.filhos.map((f) => (
                <Link key={f.id} to={`/organica/${f.id}`} className="pes-org-chip">
                  <i className={`fa ${ICONE_UNIDADE[f.tipo] ?? 'fa-building'} text-muted`} />
                  <span>{f.nome}</span>{f.sigla && <span className="pes-org-sigla">{f.sigla}</span>}
                  <small className="text-muted">{f.ocupados}/{f.lugares}</small>
                </Link>
              ))}
            </div>
          </Painel>
        )}
        <Painel titulo={`Cargos${d ? ` (${d.cargos.length})` : ''}`} icone="fa-chair" corpo={false}>
          {!d ? <div className="panel-body"><Carregando /></div> : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead><tr><th>Cargo</th><th>Posto / categoria</th><th className="text-center">Efectivo</th><th className="text-center">Ocupado</th><th>Quem ocupa</th>{gerir && <th />}</tr></thead>
                <tbody>
                  {d.cargos.map((c) => (
                    <tr key={c.id}>
                      <td><strong>{c.nome}</strong><div className="small text-muted">{c.funcaoNome}</div></td>
                      <td className="small">{c.postoRequeridoNome}</td>
                      <td className="text-center">{c.vagas}</td>
                      <td className="text-center"><span className={`badge ${c.ocupados >= c.vagas ? 'bg-success' : c.ocupados ? 'bg-warning text-dark' : 'bg-danger'}`}>{c.ocupados ? c.ocupados : 'VAGO'}</span>{c.excesso > 0 && <div className="small text-danger">+{c.excesso}</div>}</td>
                      <td>{c.ocupantes.map((o) => <Link key={o.id} to={`/pessoas/${o.id}`} className="pes-pessoa text-decoration-none mb-1"><Foto pessoaId={o.id} fotoId={o.fotoId} nome={o.nome} tamanho={30} /><span><span className="small fw-semibold">{o.abreviatura} {o.nome}</span><div className="small text-muted">{o.ident}</div></span></Link>)}{!c.ocupantes.length && <span className="text-muted small">—</span>}</td>
                      {gerir && <td className="text-end"><button type="button" className="btn btn-xs btn-outline-secondary" onClick={() => setModal({ cargo: c })} title="Editar cargo"><i className="fa fa-pencil-alt" /></button></td>}
                    </tr>
                  ))}
                </tbody>
                {!d.cargos.length && <tbody><tr><td colSpan={6} className="text-center text-muted py-4">{no.filhos.length ? 'Os cargos estão nas subunidades: abra-as acima.' : 'Sem cargos nesta unidade.'}{gerir && !no.filhos.length && ' Use «+ Cargo».'}</td></tr></tbody>}
              </table>
            </div>
          )}
        </Painel>
        {d && (
          <Painel titulo={`Efectivo da unidade (${d.efectivo.length})`} icone="fa-users">
            <Tabela titulo={`Efectivo — ${no.nome}`} linhas={d.efectivo} aoClicar={(x) => navegar(`/pessoas/${x.id}`)} ordemInicial={{ chave: 'posto', dir: 1 }} vazio="Ninguém colocado nesta unidade." colunas={[
              { chave: 'nome', titulo: 'Nome', valor: (x) => x.nome, mostrar: (x) => <span className="pes-pessoa"><Foto pessoaId={x.id} fotoId={x.fotoId} nome={x.nome} /><strong>{x.nome}</strong></span> },
              { chave: 'posto', titulo: 'Posto / categoria', valor: (x) => x.descricao, ordenarPor: (x) => 100 - x.grau },
              { chave: 'ident', titulo: 'NIP / N.º', valor: (x) => x.ident },
              { chave: 'ramo', titulo: 'Ramo', valor: (x) => x.ramo || 'Civil' },
              { chave: 'cargo', titulo: 'Cargo', valor: (x) => x.cargoNome, mostrar: (x) => x.cargoNome || <span className="text-muted small">sem cargo</span> },
              { chave: 'unidade', titulo: 'Secção / subunidade', valor: (x) => x.unidadeNome },
              { chave: 'vinculo', titulo: 'Vínculo', valor: (x) => ({ docente: 'Docente', estudante: 'Estudante', funcionario: 'Funcionário' }[x.vinculo] ?? x.vinculo) },
            ]} />
          </Painel>
        )}
        {formularios}
      </>
    )
  }

  // ---------- organograma ----------
  const totalUnidades = todas.length
  const vagos = Math.max(0, escola.lugares - escola.ocupados)
  return (
    <>
      <Cabecalho titulo="Orgânica" subtitulo="Escola Superior de Guerra" migalhas={[['Orgânica']]}>
        <button type="button" className="btn btn-outline-secondary" onClick={() => setModal({ imprimir: escola })}><i className="fa fa-print me-1" />Imprimir cargos</button>
        {gerir && <button type="button" className="btn btn-outline-theme" onClick={() => navegar('/organica/importar')}><i className="fa fa-file-excel me-1" />Carregar o quadro orgânico</button>}
        {gerir && <button type="button" className="btn btn-theme" onClick={() => setModal({ unidade: { paiId: null } })}><i className="fa fa-plus me-1" />Nova unidade</button>}
      </Cabecalho>
      <div className="pes-org-kpis mb-3">
        {[['fa-sitemap', 'Unidades', totalUnidades, '#1565c0'], ['fa-building', 'Nível raiz', escola.filhos.length, '#5e35b1'], ['fa-briefcase', 'Lugares', escola.lugares, '#00796b'], ['fa-user-check', 'Ocupados', escola.ocupados, '#2e7d32'], ['fa-user-times', 'Vagos', vagos, '#c62828']].map(([ic, t, v, cor]) => (
          <div key={t} className="pes-org-kpi"><span className="pes-org-kpi-ic" style={{ background: `${cor}18`, color: cor }}><i className={`fa ${ic}`} /></span><span><b>{v}</b><small>{t}</small></span></div>
        ))}
      </div>
      <div className="d-flex gap-2 mb-2 flex-wrap align-items-center">
        <input type="search" className="form-control form-control-sm" style={{ maxWidth: 320 }} placeholder="Procurar unidade ou sigla…" value={pesquisa} onChange={(e) => setPesquisa(e.target.value)} />
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setAbertos(new Set(todas.filter((u) => u.filhos.length).map((u) => u.id)))}><i className="fa fa-expand-arrows-alt me-1" />Expandir tudo</button>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setAbertos(new Set())}><i className="fa fa-compress-arrows-alt me-1" />Recolher</button>
        <button type="button" className={`btn btn-sm ms-auto ${verMapa ? 'btn-theme' : 'btn-outline-secondary'}`} onClick={() => setVerMapa(!verMapa)}><i className="fa fa-table me-1" />Mapa de efectivos por categoria</button>
      </div>
      <div className="pes-org-painel">
        <div className="pes-org-cab"><span><i className="fa fa-sitemap me-2" />Organograma hierárquico</span><span className="small text-muted">{totalUnidades} unidades</span></div>
        {escola.filhos.length ? escola.filhos.filter((f) => !filtro || filtro.has(f.id)).map((f) => <Linha key={f.id} n={f} nivel={0} abertos={abertos} alternar={alternar} gerir={gerir} aoAcao={aoAcao} filtro={filtro} />) : <p className="text-muted text-center py-4 mb-0">Sem unidades. {gerir && 'Use «Nova unidade» para começar.'}</p>}
        {filtro && !filtro.size && <p className="text-muted text-center py-3 mb-0">Nenhuma unidade com esse nome.</p>}
      </div>
      {verMapa && <MapaEfectivos escola={escola} colunas={arvore.colunas} navegar={navegar} />}
      {formularios}
    </>
  )
}

// mapa de efectivos (opcional): previsto e existente por categoria em cada unidade de topo
function MapaEfectivos({ escola, colunas, navegar }) {
  const total = (o) => Object.values(o).reduce((a, b) => a + b, 0)
  return (
    <Painel titulo="Mapa de efectivos: previsto (P) e existente (E) por categoria" icone="fa-table" corpo={false} className="mt-3">
      <div className="table-responsive">
        <table className="table table-sm table-bordered mb-0 pes-planeamento">
          <thead>
            <tr><th rowSpan={2}>Unidade</th>{colunas.map(([k, n, longo]) => <th key={k} colSpan={2} title={longo}>{n}</th>)}<th colSpan={2}>Total</th></tr>
            <tr>{[...colunas, ['t']].map(([k]) => [<th key={`${k}p`} className="text-muted">P</th>, <th key={`${k}e`} className="text-muted">E</th>])}</tr>
          </thead>
          <tbody>
            {[...escola.filhos, escola].map((n) => (
              <tr key={n.id ?? 'esg'} className={n.id ? '' : 'table-active fw-bold'} style={{ cursor: n.id ? 'pointer' : undefined }} onClick={() => n.id && navegar(`/organica/${n.id}`)}>
                <td>{n.id ? (n.sigla || n.nome) : 'Total da Escola'}</td>
                {colunas.map(([k]) => [<td key={`${k}p`}>{n.previsto[k] || ''}</td>, <td key={`${k}e`} className={n.existente[k] > n.previsto[k] ? 'text-danger fw-bold' : ''}>{n.existente[k] || ''}</td>])}
                <td className="fw-bold">{total(n.previsto)}</td><td className="fw-bold">{total(n.existente)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="small text-muted p-2">P: lugares dos cargos (pelo posto de cada cargo). E: pessoas colocadas (sem estudantes nem empregados domiciliares). A vermelho, mais do que o previsto.</div>
    </Painel>
  )
}

/*
  Lista dos cargos para imprimir (PDF) ou exportar (Excel), à medida: a unidade (com ou sem as subunidades),
  os vagos, os ocupados (com quem os ocupa) ou todos, e só as categorias, funções, posto exigido ou texto que
  se quiser. Agrupada por unidade (uma secção cada, pela ordem do quadro orgânico) ou numa lista só.
*/
const ESTADOS = { todos: 'Todos (um lugar por linha)', vagos: 'Só os vagos', ocupados: 'Só os ocupados (com quem ocupa)' }
const CATEGORIAS_CARGO = { oficial_general: 'Oficiais Generais', oficial_superior: 'Oficiais Superiores', oficial_capitao: 'Oficiais Capitães', oficial_subalterno: 'Oficiais Subalternos', sargento: 'Sargentos', praca: 'Praças', civil: 'Civis' }
// o nome do cargo sem a unidade e as unidades superiores («Chefe da Secção X da Direcção Y…» → «Chefe»)
const nomeCurto = (c, u) => {
  const i = u ? c.nome.indexOf(` ${u.nome}`) : -1
  return (i > 0 ? c.nome.slice(0, i).replace(/ (da|do|das|dos)$/, '') : c.nome.replace(/ da Escola Superior de Guerra$/, '')) || c.nome
}
function ImprimirCargos({ escola, inicial, aoFechar }) {
  const { ref, avisar } = useSessao()
  const { dados: cargos, erro } = useDados('/cargos')
  const [f, setF] = useState({ unidadeId: inicial ?? '', sub: true, estado: 'todos', categorias: [], funcoes: [], posto: '', texto: '', agrupar: true, curto: false })
  const [aGerar, setAGerar] = useState(false)
  const mudar = (k, v) => setF((x) => ({ ...x, [k]: v }))
  const alternar = (k, v) => setF((x) => ({ ...x, [k]: x[k].includes(v) ? x[k].filter((y) => y !== v) : [...x[k], v] }))
  const todas = useMemo(() => { const l = []; const andar = (n, nivel) => { if (n.id) l.push({ ...n, nivel }); n.filhos.forEach((x) => andar(x, nivel + 1)) }; andar(escola, 0); return l }, [escola])
  const raiz = f.unidadeId ? procurar(escola, Number(f.unidadeId)) : escola
  const unidades = useMemo(() => { if (raiz.id && !f.sub) return [raiz]; const l = []; const andar = (n) => { if (n.id) l.push(n); n.filhos.forEach(andar) }; andar(raiz); return l }, [raiz, f.sub])
  const porId = useMemo(() => new Map(todas.map((u) => [u.id, u])), [todas])
  const linhas = useMemo(() => {
    if (!cargos) return []
    const ids = new Set(unidades.map((u) => u.id))
    const t = norm(f.texto).trim()
    const ordem = new Map(todas.map((u, i) => [u.id, i]))
    return cargos
      .filter((c) => ids.has(c.unidadeId) && (!f.categorias.length || f.categorias.includes(c.categoria)) && (!f.funcoes.length || f.funcoes.includes(c.funcao)) && (!f.posto || c.postoRequerido === f.posto) && (!t || norm(c.nome).includes(t)))
      .sort((a, b) => ordem.get(a.unidadeId) - ordem.get(b.unidadeId))
      .flatMap((c) => (f.estado === 'vagos' ? (c.livres ? [{ c, o: null }] : []) : f.estado === 'ocupados' ? c.ocupantes.map((o) => ({ c, o })) : [...c.ocupantes.map((o) => ({ c, o })), ...Array.from({ length: c.livres }, () => ({ c, o: null }))]))
  }, [cargos, unidades, todas, f])
  async function gerar(formato) {
    setAGerar(true)
    try {
      const nome = (l) => (f.curto ? nomeCurto(l.c, porId.get(l.c.unidadeId)) : l.c.nome)
      const colunas = [
        { titulo: 'N/O', valor: (_, i) => String(i + 1).padStart(2, '0'), alinhar: 'center', largura: 10 },
        ...(f.agrupar ? [] : [{ titulo: 'Unidade', valor: (l) => porId.get(l.c.unidadeId)?.nome ?? '', largura: 55 }]),
        { titulo: 'Cargo', valor: nome },
        { titulo: 'Posto exigido', valor: (l) => l.c.postoRequeridoNome || 'Civil', largura: 28 },
        ...(f.estado === 'vagos'
          ? [{ titulo: 'Lugares vagos', valor: (l) => l.c.livres, alinhar: 'center', largura: 18 }]
          : [{ titulo: 'Posto / categoria', valor: (l) => l.o?.descricao ?? '', largura: 30 }, { titulo: 'Nome', valor: (l) => l.o?.nome ?? 'VAGO', largura: 55 }, { titulo: 'NIP / N.º agente', valor: (l) => l.o?.ident ?? '', largura: 26 }]),
      ]
      const seccoes = f.agrupar
        ? unidades.map((u) => ({ titulo: u.nome, colunas, linhas: linhas.filter((l) => l.c.unidadeId === u.id) })).filter((x) => x.linhas.length)
        : [{ colunas, linhas }]
      const filtros = [f.categorias.map((k) => CATEGORIAS_CARGO[k]).join(', '), f.funcoes.map((k) => ref.funcoes[k]).join(', '), f.posto && `posto exigido ${ref.postos.EXE.find((p) => p.id === f.posto)?.nome}`, f.texto && `«${f.texto}»`].filter(Boolean)
      const d = { titulo: `${f.estado === 'vagos' ? 'CARGOS VAGOS' : f.estado === 'ocupados' ? 'CARGOS OCUPADOS' : 'CARGOS DO QUADRO ORGÂNICO'} — ${raiz.nome.toLocaleUpperCase('pt')}`, subtitulo: [raiz.id && (f.sub ? 'com as subunidades' : 'só a unidade, sem as subunidades'), ...filtros].filter(Boolean).join(' · '), orientacao: 'landscape', seccoes }
      await (formato === 'excel' ? documentoExcel(d) : documentoPdf(d))
      aoFechar()
    } catch (e) {
      avisar(e.message, 'erro')
    } finally {
      setAGerar(false)
    }
  }
  const lugares = new Set(linhas.map((l) => l.c.id)).size
  return (
    <Modal largo titulo="Imprimir cargos" aoFechar={aoFechar} rodape={<><span className="me-auto small text-muted">{cargos ? `${linhas.length} linha(s) · ${lugares} cargo(s)` : 'A carregar…'}</span><button type="button" className="btn btn-outline-secondary" onClick={aoFechar}>Cancelar</button><button type="button" className="btn btn-outline-theme" disabled={aGerar || !linhas.length} onClick={() => gerar('excel')}><i className="fa fa-file-excel me-1" />Excel</button><button type="button" className="btn btn-theme" disabled={aGerar || !linhas.length} onClick={() => gerar('pdf')}><i className="fa fa-print me-1" />Imprimir (PDF)</button></>}>
      {erro && <div className="alert alert-danger">{erro}</div>}
      <div className="row">
        <Campo rotulo="Unidade" col="col-md-8"><Escolha valor={f.unidadeId} aoMudar={(v) => mudar('unidadeId', v)} opcoes={todas.map((u) => [u.id, `${'\u00a0'.repeat((u.nivel - 1) * 4)}${u.nome}`])} vazio="Toda a Escola" /></Campo>
        <Campo rotulo="Subunidades" col="col-md-4"><div className="form-check mt-1"><input className="form-check-input" type="checkbox" id="imp-sub" checked={f.sub} disabled={!f.unidadeId} onChange={(e) => mudar('sub', e.target.checked)} /><label className="form-check-label" htmlFor="imp-sub">Incluir as subunidades</label></div></Campo>
        <Campo rotulo="Cargos" col="col-12">
          <div className="d-flex flex-wrap gap-3">{Object.entries(ESTADOS).map(([k, t]) => <div key={k} className="form-check"><input className="form-check-input" type="radio" id={`imp-${k}`} checked={f.estado === k} onChange={() => mudar('estado', k)} /><label className="form-check-label" htmlFor={`imp-${k}`}>{t}</label></div>)}</div>
        </Campo>
        <Campo rotulo="Categoria (nenhuma marcada = todas)" col="col-12">
          <div className="d-flex flex-wrap gap-3">{Object.entries(CATEGORIAS_CARGO).map(([k, t]) => <div key={k} className="form-check"><input className="form-check-input" type="checkbox" id={`imp-c-${k}`} checked={f.categorias.includes(k)} onChange={() => alternar('categorias', k)} /><label className="form-check-label" htmlFor={`imp-c-${k}`}>{t}</label></div>)}</div>
        </Campo>
        <Campo rotulo="Função (nenhuma marcada = todas)" col="col-12">
          <div className="d-flex flex-wrap gap-3">{Object.entries(ref.funcoes).map(([k, t]) => <div key={k} className="form-check"><input className="form-check-input" type="checkbox" id={`imp-f-${k}`} checked={f.funcoes.includes(k)} onChange={() => alternar('funcoes', k)} /><label className="form-check-label" htmlFor={`imp-f-${k}`}>{t}</label></div>)}</div>
        </Campo>
        <Campo rotulo="Posto exigido" col="col-md-4"><Escolha valor={f.posto} aoMudar={(v) => mudar('posto', v)} opcoes={ref.postos.EXE.map((p) => [p.id, p.nome])} vazio="Qualquer" /></Campo>
        <Campo rotulo="O nome do cargo tem" col="col-md-8"><input className="form-control form-control-sm" value={f.texto} onChange={(e) => mudar('texto', e.target.value)} placeholder="Ex.: Professor, Chefe, Condutor, Amanuense…" /></Campo>
        <Campo rotulo="Apresentação" col="col-12">
          <div className="d-flex flex-wrap gap-3">
            <div className="form-check"><input className="form-check-input" type="checkbox" id="imp-agrupar" checked={f.agrupar} onChange={(e) => mudar('agrupar', e.target.checked)} /><label className="form-check-label" htmlFor="imp-agrupar">Uma secção por unidade (senão, uma lista só com a coluna Unidade)</label></div>
            <div className="form-check"><input className="form-check-input" type="checkbox" id="imp-curto" checked={f.curto} onChange={(e) => mudar('curto', e.target.checked)} /><label className="form-check-label" htmlFor="imp-curto">Nome curto do cargo (sem a unidade: «Chefe», «Professor de Estratégia»…)</label></div>
          </div>
        </Campo>
      </div>
    </Modal>
  )
}

function FormUnidade({ u, unidades, aoFechar, aoGuardar }) {
  const { ref } = useSessao()
  const [d, setD] = useState({ nome: u.nome ?? '', sigla: u.sigla ?? '', tipo: u.tipo ?? 'outro', paiId: u.paiId ?? '', ordem: u.ordem ?? 0 })
  const [erro, setErro] = useState('')
  const guardar = () => api(u.id ? `/unidades/${u.id}` : '/unidades', { metodo: u.id ? 'PUT' : 'POST', corpo: { ...d, paiId: d.paiId ? Number(d.paiId) : null, ordem: Number(d.ordem) } }).then(() => aoGuardar('Unidade guardada.')).catch((e) => setErro(e.message))
  const apagar = () => api(`/unidades/${u.id}`, { metodo: 'DELETE' }).then(() => aoGuardar('Unidade apagada.')).catch((e) => setErro(e.message))
  return (
    <Modal titulo={u.id ? 'Editar unidade' : 'Nova unidade'} aoFechar={aoFechar} rodape={<>{u.id && <button type="button" className="btn btn-outline-danger me-auto" onClick={apagar}>Apagar</button>}<button type="button" className="btn btn-outline-secondary" onClick={aoFechar}>Cancelar</button><button type="button" className="btn btn-theme" onClick={guardar}>Guardar</button></>}>
      {erro && <div className="alert alert-danger">{erro}</div>}
      <div className="row">
        <Campo rotulo="Nome" obrigatorio col="col-md-8"><input className="form-control form-control-sm" value={d.nome} onChange={(e) => setD({ ...d, nome: e.target.value })} /></Campo>
        <Campo rotulo="Sigla" col="col-md-4"><input className="form-control form-control-sm" value={d.sigla} onChange={(e) => setD({ ...d, sigla: e.target.value })} /></Campo>
        <Campo rotulo="Tipo" col="col-md-4"><Escolha valor={d.tipo} aoMudar={(v) => setD({ ...d, tipo: v })} opcoes={ref.tiposUnidade} vazio={null} /></Campo>
        <Campo rotulo="Dentro de (unidade-mãe)" col="col-md-8"><Escolha valor={d.paiId} aoMudar={(v) => setD({ ...d, paiId: v })} opcoes={unidades.filter((x) => x.id !== u.id).map((x) => [x.id, x.nome])} vazio="(topo)" /></Campo>
        <Campo rotulo="Ordem" col="col-md-12"><input type="number" className="form-control form-control-sm" value={d.ordem} onChange={(e) => setD({ ...d, ordem: e.target.value })} /></Campo>
      </div>
    </Modal>
  )
}

function FormCargo({ c, unidades, refs, aoFechar, aoGuardar }) {
  const [d, setD] = useState({ nome: c.nome ?? '', unidadeId: c.unidadeId ?? '', funcao: c.funcao ?? 'execucao', tipo: c.tipo ?? 'militar', postoRequerido: c.postoRequerido ?? '', categoriaCivil: c.categoriaCivil ?? '', vagas: c.vagas ?? 1 })
  const [erro, setErro] = useState('')
  const guardar = () => api(c.id ? `/cargos/${c.id}` : '/cargos', { metodo: c.id ? 'PUT' : 'POST', corpo: { ...d, unidadeId: d.unidadeId ? Number(d.unidadeId) : null, postoRequerido: d.postoRequerido || null, categoriaCivil: d.categoriaCivil || null, vagas: Number(d.vagas) } }).then(() => aoGuardar('Cargo guardado.')).catch((e) => setErro(e.message))
  const apagar = () => api(`/cargos/${c.id}`, { metodo: 'DELETE' }).then(() => aoGuardar('Cargo apagado.')).catch((e) => setErro(e.message))
  return (
    <Modal titulo={c.id ? 'Editar cargo' : 'Novo cargo'} aoFechar={aoFechar} rodape={<>{c.id && <button type="button" className="btn btn-outline-danger me-auto" onClick={apagar}>Apagar</button>}<button type="button" className="btn btn-outline-secondary" onClick={aoFechar}>Cancelar</button><button type="button" className="btn btn-theme" onClick={guardar}>Guardar</button></>}>
      {erro && <div className="alert alert-danger">{erro}</div>}
      <div className="row">
        <Campo rotulo="Cargo" obrigatorio col="col-12"><input className="form-control form-control-sm" value={d.nome} onChange={(e) => setD({ ...d, nome: e.target.value })} /></Campo>
        <Campo rotulo="Unidade"><Escolha valor={d.unidadeId} aoMudar={(v) => setD({ ...d, unidadeId: v })} opcoes={unidades.map((u) => [u.id, u.nome])} /></Campo>
        <Campo rotulo="Função (art. 21.º)"><Escolha valor={d.funcao} aoMudar={(v) => setD({ ...d, funcao: v })} opcoes={refs.funcoes} vazio={null} /></Campo>
        <Campo rotulo="Para" col="col-md-4"><Escolha valor={d.tipo} aoMudar={(v) => setD({ ...d, tipo: v })} opcoes={{ militar: 'Militar', civil: 'Civil', ambos: 'Militar ou civil' }} vazio={null} /></Campo>
        {d.tipo !== 'civil' && <Campo rotulo="Posto do cargo" col="col-md-4" ajuda="Ninguém é nomeado para cargo de posto inferior (art. 19.º)."><Escolha valor={d.postoRequerido} aoMudar={(v) => setD({ ...d, postoRequerido: v })} opcoes={refs.postos.EXE.map((p) => [p.id, `${p.nome} / ${refs.postos.MGA.find((x) => x.id === p.id).nome}`])} /></Campo>}
        {d.tipo !== 'militar' && <Campo rotulo="Categoria (civis)" col="col-md-4"><Escolha valor={d.categoriaCivil} aoMudar={(v) => setD({ ...d, categoriaCivil: v })} opcoes={Object.values(refs.carreirasCivis).filter((v) => !v.domiciliar).sort((a, b) => a.nivel - b.nivel).map((v) => [v.nome, v.nome])} vazio="Qualquer" /></Campo>}
        <Campo rotulo="Lugares" col="col-md-4"><input type="number" min="1" className="form-control form-control-sm" value={d.vagas} onChange={(e) => setD({ ...d, vagas: e.target.value })} /></Campo>
      </div>
    </Modal>
  )
}
