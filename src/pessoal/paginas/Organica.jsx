import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { useSessao } from '../sessao'
import { useDados } from '../useDados'
import Foto from '../componentes/Foto'
import { Cabecalho, Campo, Carregando, Erro, Escolha, Modal, Painel } from '../componentes/Ui'

const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0)
const procurar = (n, id) => (n.id === id ? n : n.filhos.reduce((r, f) => r ?? procurar(f, id), null))
const caminhoAte = (n, id, c = []) => (n.id === id ? [...c, n] : n.filhos.reduce((r, f) => r ?? caminhoAte(f, id, [...c, n]), null))

function Ramo({ n, atual, abertos, alternar, navegar }) {
  const aberto = abertos.has(n.id ?? 'raiz')
  return (
    <li>
      <button type="button" className={atual === n.id ? 'ativo' : ''} onClick={() => { navegar(n.id ? `/organica/${n.id}` : '/organica'); if (n.filhos.length && !aberto) alternar(n.id ?? 'raiz') }}>
        {n.filhos.length ? <i className={`fa fa-fw ${aberto ? 'fa-caret-down' : 'fa-caret-right'}`} onClick={(e) => { e.stopPropagation(); alternar(n.id ?? 'raiz') }} /> : <i className="fa fa-fw fa-circle" style={{ fontSize: 5 }} />}
        <i className={`fa ${n.id ? 'fa-building' : 'fa-landmark'} opacity-75`} />
        <span>{n.sigla && n.id ? <strong className="me-1">{n.sigla}</strong> : null}{n.id ? n.nome : <strong>{n.nome}</strong>}</span>
        <span className="pes-num" title="Lugares ocupados / previstos">{n.ocupados}/{n.lugares}</span>
      </button>
      {aberto && n.filhos.length > 0 && <ul>{n.filhos.map((f) => <Ramo key={f.id} n={f} atual={atual} abertos={abertos} alternar={alternar} navegar={navegar} />)}</ul>}
    </li>
  )
}

// orgânica e planeamento (como no SIGP): árvore, números por categoria, subunidades e cargos com os ocupantes
export default function Organica() {
  const { id } = useParams()
  const atualId = id ? Number(id) : null
  const { ref, pode, avisar } = useSessao()
  const navegar = useNavigate()
  const { dados: arvore, erro, recarregar } = useDados('/organica')
  const detalhe = useDados(atualId ? `/organica/${atualId}` : null)
  const [abertos, setAbertos] = useState(() => new Set(['raiz']))
  const [modal, setModal] = useState(null)
  const alternar = (k) => setAbertos((a) => { const n = new Set(a); if (n.has(k)) n.delete(k); else n.add(k); return n })
  const unidades = useMemo(() => {
    const l = []
    const andar = (n, nivel) => { if (n.id) l.push({ id: n.id, nome: `${'— '.repeat(nivel - 1)}${n.nome}`, paiId: n.paiId }); n.filhos.forEach((f) => andar(f, nivel + 1)) }
    if (arvore) andar(arvore.escola, 0)
    return l
  }, [arvore])

  if (erro) return <Erro texto={erro} aoRepetir={recarregar} />
  if (!arvore) return <Carregando />
  const no = atualId ? procurar(arvore.escola, atualId) : arvore.escola
  if (!no) return <Erro texto="Unidade não encontrada." />
  const caminho = atualId ? caminhoAte(arvore.escola, atualId) : [arvore.escola]
  const gerir = pode('administrar')
  const depois = (m) => { setModal(null); avisar(m); recarregar(); detalhe.recarregar() }
  const col = arvore.colunas
  const linhas = no.filhos
  const totalPrev = (n) => Object.values(n.previsto).reduce((a, b) => a + b, 0)
  const totalExist = (n) => Object.values(n.existente).reduce((a, b) => a + b, 0)

  return (
    <>
      <Cabecalho titulo="Orgânica e planeamento" subtitulo="efectivo previsto e existente" migalhas={[['Orgânica']]}>
        {gerir && <button type="button" className="btn btn-outline-theme" onClick={() => setModal({ unidade: { paiId: atualId } })}><i className="fa fa-plus me-1" />Subunidade</button>}
        {gerir && atualId && <button type="button" className="btn btn-theme" onClick={() => setModal({ cargo: { unidadeId: atualId } })}><i className="fa fa-plus me-1" />Cargo</button>}
      </Cabecalho>
      <div className="row">
        <div className="col-xl-3">
          <Painel titulo="Estrutura" icone="fa-sitemap"><ul className="pes-arvore"><Ramo n={arvore.escola} atual={atualId} abertos={abertos} alternar={alternar} navegar={navegar} /></ul></Painel>
        </div>
        <div className="col-xl-9">
          <ol className="breadcrumb mb-2">{caminho.map((c, i) => <li key={c.id ?? 'raiz'} className="breadcrumb-item">{i < caminho.length - 1 ? <Link to={c.id ? `/organica/${c.id}` : '/organica'}>{c.sigla || c.nome}</Link> : <strong>{c.nome}</strong>}</li>)}</ol>
          <div className="d-flex align-items-center gap-2 mb-3">
            <h3 className="mb-0 me-auto">{no.nome} {no.sigla && no.id && <small className="text-muted">{no.sigla}</small>}</h3>
            {gerir && atualId && <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setModal({ unidade: detalhe.dados ?? { id: atualId, nome: no.nome, sigla: no.sigla, paiId: no.paiId } })}><i className="fa fa-pen me-1" />Editar unidade</button>}
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => navegar(atualId ? `/pessoas?unidadeId=${atualId}` : '/pessoas')}><i className="fa fa-users me-1" />Ver as pessoas</button>
          </div>
          <div className="row g-2 mb-3">
            {[['Lugares previstos', no.lugares, 'fa-chair'], ['Ocupados', no.ocupados, 'fa-user-check'], ['Preenchimento', `${pct(no.ocupados, no.lugares)}%`, 'fa-percentage'], ['Efectivo existente', no.pessoas, 'fa-users'], ['Mulheres', no.mulheres, 'fa-venus'], ['Estudantes', no.estudantes, 'fa-user-graduate']].map(([t, v, ic]) => (
              <div key={t} className="col-6 col-md-4 col-xl-2"><div className="border rounded p-2 bg-white h-100"><div className="small text-muted"><i className={`fa ${ic} me-1`} />{t}</div><div className="fs-4 fw-bold">{v}</div></div></div>
            ))}
          </div>

          <Painel titulo="Planeamento: efectivo previsto (P) e existente (E) por categoria" icone="fa-table" corpo={false}>
            <div className="table-responsive">
              <table className="table table-sm table-bordered mb-0 pes-planeamento">
                <thead>
                  <tr><th rowSpan={2}>{linhas.length ? 'Subunidade' : 'Unidade'}</th>{col.map(([k, n, longo]) => <th key={k} colSpan={2} title={longo}>{n}</th>)}<th colSpan={2}>Total</th><th rowSpan={2}>%</th></tr>
                  <tr>{[...col, ['t']].map(([k]) => [<th key={`${k}p`} className="text-muted">P</th>, <th key={`${k}e`} className="text-muted">E</th>])}</tr>
                </thead>
                <tbody>
                  {(linhas.length ? linhas : [no]).map((n) => (
                    <tr key={n.id ?? 'raiz'} style={{ cursor: n.id && n.id !== atualId ? 'pointer' : undefined }} onClick={() => n.id && n.id !== atualId && navegar(`/organica/${n.id}`)}>
                      <td><strong>{n.sigla || n.nome}</strong>{n.sigla && <div className="small text-muted">{n.nome}</div>}</td>
                      {col.map(([k]) => [<td key={`${k}p`}>{n.previsto[k] || ''}</td>, <td key={`${k}e`} className={n.existente[k] > n.previsto[k] ? 'text-danger fw-bold' : n.existente[k] < n.previsto[k] ? 'text-warning' : ''}>{n.existente[k] || ''}</td>])}
                      <td className="fw-bold">{totalPrev(n)}</td><td className="fw-bold">{totalExist(n)}</td>
                      <td><div className="pes-barra" style={{ minWidth: 50 }}><span style={{ width: `${Math.min(100, pct(n.ocupados, n.lugares))}%` }} /></div><small>{pct(n.ocupados, n.lugares)}%</small></td>
                    </tr>
                  ))}
                  {linhas.length > 0 && (
                    <tr className="table-active fw-bold"><td>Total</td>{col.map(([k]) => [<td key={`${k}p`}>{no.previsto[k] || ''}</td>, <td key={`${k}e`}>{no.existente[k] || ''}</td>])}<td>{totalPrev(no)}</td><td>{totalExist(no)}</td><td>{pct(no.ocupados, no.lugares)}%</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="small text-muted p-2">P: lugares dos cargos do quadro orgânico (pelo posto de cada cargo). E: pessoas colocadas. A vermelho, mais do que o previsto; a amarelo, falta preencher. Os estudantes dos cursos e os empregados domiciliares não contam no efectivo.</div>
          </Painel>

          {linhas.length > 0 && (
            <Painel titulo={`Subunidades (${linhas.length})`} icone="fa-building">
              <div className="row g-2">
                {linhas.map((f) => (
                  <div key={f.id} className="col-md-6 col-xl-4">
                    <button type="button" className="pes-cartao-unidade" onClick={() => navegar(`/organica/${f.id}`)}>
                      <div className="d-flex"><strong className="me-auto">{f.nome}</strong>{f.sigla && <span className="badge bg-light text-dark border">{f.sigla}</span>}</div>
                      <div className="small text-muted my-1">{f.cargos} cargo(s) · {f.pessoas} pessoa(s){f.estudantes ? ` · ${f.estudantes} estudante(s)` : ''}{f.filhos.length ? ` · ${f.filhos.length} subunidade(s)` : ''}</div>
                      <div className="pes-barra"><span style={{ width: `${Math.min(100, pct(f.ocupados, f.lugares))}%` }} /></div>
                      <div className="small mt-1">{f.ocupados} de {f.lugares} lugares ocupados ({pct(f.ocupados, f.lugares)}%)</div>
                    </button>
                  </div>
                ))}
              </div>
            </Painel>
          )}

          {atualId && (detalhe.dados ? (
            <>
              <Painel titulo={`Cargos (${detalhe.dados.cargos.length})`} icone="fa-chair" corpo={false}>
                <div className="table-responsive">
                  <table className="table table-hover mb-0 align-middle">
                    <thead><tr><th>Cargo</th><th>Função</th><th>Posto / categoria</th><th className="text-center">Efectivo</th><th className="text-center">Ocupado</th><th>Ocupantes</th>{gerir && <th />}</tr></thead>
                    <tbody>
                      {detalhe.dados.cargos.map((c) => (
                        <tr key={c.id}>
                          <td><strong>{c.nome}</strong></td>
                          <td className="small">{c.funcaoNome}</td>
                          <td className="small">{c.postoRequeridoNome}<div className="text-muted">{c.categoria}</div></td>
                          <td className="text-center">{c.vagas}</td>
                          <td className="text-center"><span className={`badge ${c.ocupados >= c.vagas ? 'bg-success' : c.ocupados ? 'bg-warning text-dark' : 'bg-secondary'}`}>{c.ocupados}</span>{c.excesso > 0 && <div className="small text-danger">+{c.excesso} a mais</div>}</td>
                          <td>{c.ocupantes.map((o) => <Link key={o.id} to={`/pessoas/${o.id}`} className="pes-pessoa text-decoration-none mb-1"><Foto pessoaId={o.id} fotoId={o.fotoId} nome={o.nome} tamanho={30} /><span><span className="small fw-semibold">{o.abreviatura} {o.nome}</span><div className="small text-muted">{o.ident}</div></span></Link>)}{!c.ocupantes.length && <span className="text-muted small">Vago</span>}</td>
                          {gerir && <td><button type="button" className="btn btn-xs btn-outline-secondary" onClick={() => setModal({ cargo: c })} title="Editar cargo"><i className="fa fa-pen" /></button></td>}
                        </tr>
                      ))}
                      {!detalhe.dados.cargos.length && <tr><td colSpan={7} className="text-muted">Sem cargos registados nesta unidade.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </Painel>
              {detalhe.dados.semCargo.length > 0 && (
                <Painel titulo={`Colocados sem cargo (${detalhe.dados.semCargo.length})`} icone="fa-user-clock">
                  <div className="row g-2">{detalhe.dados.semCargo.map((o) => <div key={o.id} className="col-md-6 col-xl-4"><Link to={`/pessoas/${o.id}`} className="pes-pessoa text-decoration-none"><Foto pessoaId={o.id} fotoId={o.fotoId} nome={o.nome} /><span><span className="small fw-semibold">{o.abreviatura} {o.nome}</span><div className="small text-muted">{o.descricao}{o.vinculo === 'estudante' ? ' · estudante' : ''}</div></span></Link></div>)}</div>
                </Painel>
              )}
            </>
          ) : <Carregando />)}
        </div>
      </div>
      {modal?.unidade && <FormUnidade u={modal.unidade} unidades={unidades} aoFechar={() => setModal(null)} aoGuardar={depois} />}
      {modal?.cargo && <FormCargo c={modal.cargo} unidades={unidades} refs={ref} aoFechar={() => setModal(null)} aoGuardar={depois} />}
    </>
  )
}

function FormUnidade({ u, unidades, aoFechar, aoGuardar }) {
  const [d, setD] = useState({ nome: u.nome ?? '', sigla: u.sigla ?? '', paiId: u.paiId ?? '', ordem: u.ordem ?? 0 })
  const [erro, setErro] = useState('')
  const guardar = () => api(u.id ? `/unidades/${u.id}` : '/unidades', { metodo: u.id ? 'PUT' : 'POST', corpo: { ...d, paiId: d.paiId ? Number(d.paiId) : null, ordem: Number(d.ordem) } }).then(() => aoGuardar('Unidade guardada.')).catch((e) => setErro(e.message))
  const apagar = () => api(`/unidades/${u.id}`, { metodo: 'DELETE' }).then(() => aoGuardar('Unidade apagada.')).catch((e) => setErro(e.message))
  return (
    <Modal titulo={u.id ? 'Editar unidade' : 'Nova unidade'} aoFechar={aoFechar} rodape={<>{u.id && <button type="button" className="btn btn-outline-danger me-auto" onClick={apagar}>Apagar</button>}<button type="button" className="btn btn-outline-secondary" onClick={aoFechar}>Cancelar</button><button type="button" className="btn btn-theme" onClick={guardar}>Guardar</button></>}>
      {erro && <div className="alert alert-danger">{erro}</div>}
      <div className="row">
        <Campo rotulo="Nome" obrigatorio col="col-md-8"><input className="form-control form-control-sm" value={d.nome} onChange={(e) => setD({ ...d, nome: e.target.value })} /></Campo>
        <Campo rotulo="Sigla" col="col-md-4"><input className="form-control form-control-sm" value={d.sigla} onChange={(e) => setD({ ...d, sigla: e.target.value })} /></Campo>
        <Campo rotulo="Dentro de" col="col-md-8"><Escolha valor={d.paiId} aoMudar={(v) => setD({ ...d, paiId: v })} opcoes={unidades.filter((x) => x.id !== u.id).map((x) => [x.id, x.nome])} vazio="(topo)" /></Campo>
        <Campo rotulo="Ordem" col="col-md-4"><input type="number" className="form-control form-control-sm" value={d.ordem} onChange={(e) => setD({ ...d, ordem: e.target.value })} /></Campo>
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
        {d.tipo !== 'militar' && <Campo rotulo="Categoria (civis)" col="col-md-4"><input className="form-control form-control-sm" value={d.categoriaCivil} onChange={(e) => setD({ ...d, categoriaCivil: e.target.value })} /></Campo>}
        <Campo rotulo="Lugares" col="col-md-4"><input type="number" min="1" className="form-control form-control-sm" value={d.vagas} onChange={(e) => setD({ ...d, vagas: e.target.value })} /></Campo>
      </div>
    </Modal>
  )
}
