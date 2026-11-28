import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { useSessao } from '../../sessaoContexto'
import { Aviso, CabecalhoPagina, Carregando, Erro, Janela, Painel } from '../../componentes/Ui'
import { dataHora } from '../../formatar'
import { ESTADOS_PERIODO, PAPEIS_DOCENCIA, PERIODOS, estadoDoPeriodo } from './comum'
import { t as tx } from '../../../i18n/linguas'
import { useAnoTrabalho } from '../../anoTrabalho'

const PROPOSTO = <span className="badge bg-warning text-dark ms-1">{tx('proposto')}</span>

/*
  Alocação de docentes: carga horária de cada docente e cadeiras por alocar (turmas ativas). Quem o Ensino põe
  numa cadeira fica «proposto» (sem acesso) até o Comandante aprovar a distribuição do ano lectivo (uma só lista,
  todas as turmas), que o Ensino imprime e lhe envia aqui depois de rever. As cadeiras aparecem agrupadas por turma (abre-se a turma que se quer).
  Quem só vê (o Comandante) não tem os botões de alocar nem de enviar: aprova em «Por aprovar».
*/
function Alocacao() {
  const { pode } = useSessao()
  const gere = pode('academico.gerir')
  // o Comandante aprova (o que ele próprio aloca já fica aprovado)
  const aprova = pode('academico.homologar')
  const [abertas, setAbertas] = useState({})
  const [d, setD] = useState(null)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState(null)
  const carregar = () => api('/academico/alocacao').then(setD).catch((e) => setErro(e.message))
  // uma só lista por ano lectivo (todas as turmas)
  const enviar = (anoLetivo, propostos) => {
    if (!window.confirm(tx('Enviar ao Comandante a distribuição dos docentes do ano lectivo {0} ({1} docente(s) propostos)? Os docentes propostos só têm a cadeira (e a conta) depois de ele aprovar.', { 0: anoLetivo, 1: propostos }))) return
    api('/academico/distribuicao', { metodo: 'POST', corpo: { anoLetivo } })
      .then((r) => { setAviso({ texto: tx('Enviada ao Comandante ({0} docente(s) propostos).', { 0: r.propostos }) }); carregar() })
      .catch((e) => setAviso({ tipo: 'erro', texto: e.message }))
  }
  const [filtro, setFiltro] = useState('todas')
  // filtros: o ano letivo (o atual por omissão) e o semestre em que a cadeira é dada
  // o ano lectivo de trabalho (do menu); «todos» só nesta página
  const { ano: anoTrabalho, anos, mudar } = useAnoTrabalho()
  const [todos, setTodos] = useState(false)
  const ano = todos ? '' : anoTrabalho
  const setAno = (v) => { if (v) { setTodos(false); mudar(v) } else setTodos(true) }
  const [semestre, setSemestre] = useState('')
  useEffect(() => { carregar() }, [])
  // a janela de alocar: a cadeira desta turma (a mesma cadeira noutro curso tem o seu próprio docente)
  const [alocar, setAlocar] = useState(null)

  if (erro) return <Erro texto={erro} />
  if (!d) return <Carregando />

  const doFiltro = d.cadeiras.filter((c) => (!ano || c.turma?.anoLetivo === ano) && (!semestre || String(c.periodo) === semestre))
  const anoDe = (c) => anos.find((a) => a.id === c.turma?.anoLetivo)
  const semRegente = doFiltro.filter((c) => !c.docentes.some((x) => x.papel === 'regente'))
  const semDocentes = doFiltro.filter((c) => c.docentes.length === 0)
  const horasTotal = d.docentes.reduce((s, x) => s + x.horas, 0)
  const cadeiras = filtro === 'sem-regente' ? semRegente : doFiltro
  const maxHoras = Math.max(1, ...d.docentes.map((x) => x.horas))
  // as cadeiras agrupadas por turma (pela ordem em que vêm)
  const grupos = new Map()
  for (const c of cadeiras) {
    const k = c.turma?.id ?? 0
    if (!grupos.has(k)) grupos.set(k, [c.turma ?? { id: 0, nome: tx('Sem turma') }, []])
    grupos.get(k)[1].push(c)
  }
  const porTurma = [...grupos.values()]
  // a distribuição por ano lectivo: soma das turmas; o estado é o pedido em curso ou a última decisão
  const anosDist = new Map()
  for (const t of d.turmas) {
    const x = anosDist.get(t.anoLetivo) ?? { anoLetivo: t.anoLetivo, turmas: 0, cadeiras: 0, propostos: 0, semDocentes: 0, estados: [] }
    x.turmas++; x.cadeiras += t.cadeiras; x.propostos += t.propostos; x.semDocentes += t.semDocentes
    if (t.distribuicao) x.estados.push(t.distribuicao)
    anosDist.set(t.anoLetivo, x)
  }
  const porAno = [...anosDist.values()].sort((a, b) => b.anoLetivo.localeCompare(a.anoLetivo)).map(({ estados, ...x }) => ({
    ...x, distribuicao: estados.find((e) => e.estado === 'pendente') ?? [...estados].sort((a, b) => String(b.decididoEm ?? '').localeCompare(String(a.decididoEm ?? '')))[0] ?? null,
  }))

  const widgets = [
    ['bg-dark', 'fa-chalkboard-teacher', tx('DOCENTES'), d.docentes.length, tx('{0} com cadeiras', { 0: d.docentes.filter((x) => x.cadeiras.length).length })],
    ['bg-red', 'fa-book', tx('CADEIRAS (TURMAS ACTIVAS)'), doFiltro.length, tx('{0} sem docentes', { 0: semDocentes.length })],
    ['bg-orange', 'fa-user-clock', tx('SEM REGENTE'), semRegente.length, tx('precisam de alocação')],
    ['bg-teal', 'fa-clock', tx('HORAS ALOCADAS'), horasTotal, tx('em todas as cadeiras')],
  ]

  return (
    <>
      <CabecalhoPagina titulo={tx('Docentes nas cadeiras')} subtitulo={tx('regentes, assistentes e carga horária')} migalhas={[{ rotulo: tx('Administração Escolar') }, { rotulo: tx('Docentes nas cadeiras') }]}>
        <Link to="/academico/docentes-horarios" className="btn btn-white"><i className="fa fa-user-tag me-1" />{tx('Docentes dos horários do arquivo')}</Link>
      </CabecalhoPagina>
      <div className="d-flex flex-wrap gap-2 mb-3">
        <select className="form-select w-auto" value={ano} onChange={(e) => setAno(e.target.value)} aria-label={tx('Ano lectivo')}>
          <option value="">{tx('Todos os anos lectivos')}</option>
          {anos.map((a) => <option key={a.id} value={a.id}>{a.id}{a.atual ? ` (${tx('atual')})` : ''}</option>)}
        </select>
        <select className="form-select w-auto" value={semestre} onChange={(e) => setSemestre(e.target.value)} aria-label={tx('Semestre')}>
          <option value="">{tx('Todos os semestres')}</option>
          {Object.entries(PERIODOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <div className="row">
        {widgets.map(([cor, icone, titulo, valor, nota]) => (
          <div key={titulo} className="col-xl-3 col-md-6">
            <div className={`widget widget-stats ${cor}`}>
              <div className="stats-icon"><i className={`fa ${icone}`} /></div>
              <div className="stats-info"><h4>{titulo}</h4><p>{valor}</p></div>
              <div className="stats-link"><span className="d-block px-3 py-2 small">{nota}</span></div>
            </div>
          </div>
        ))}
      </div>

      {!gere && (
        <div className="alert alert-info d-flex align-items-start">
          <i className="fa fa-info-circle fa-lg me-2 mt-1" />
          <div>{tx('Quem distribui os docentes pelas cadeiras é a Direcção de Ensino (Repartição de Administração Escolar). Depois de rever a lista do ano lectivo, imprime-a e envia-a ao Comandante, que a aprova, manda refazer ou rejeita em')} <Link to="/publicacoes" className="fw-bold">{tx('Por aprovar')}</Link>. {tx('Aqui só se consulta.')}</div>
        </div>
      )}
      {d.turmas.length > 0 && (
        <Painel titulo={tx('Distribuição de serviço docente (uma lista por ano lectivo)')} corpo={false}>
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead><tr><th>{tx('Ano lectivo')}</th><th>{tx('Turmas')}</th><th>{tx('Cadeiras')}</th><th>{tx('Docentes propostos')}</th>{d.aprovacaoComandante && <th>{tx('Estado')}</th>}<th /></tr></thead>
              <tbody>
                {porAno.filter((x) => !ano || x.anoLetivo === ano).map((x) => {
                  const e = x.distribuicao?.estado
                  return (
                    <tr key={x.anoLetivo}>
                      <td className="fw-bold">{x.anoLetivo}</td>
                      <td>{x.turmas}</td>
                      <td>{x.cadeiras}{x.semDocentes > 0 && <div className="small text-warning">{tx('{0} sem docentes', { 0: x.semDocentes })}</div>}</td>
                      <td>{x.propostos}</td>
                      {d.aprovacaoComandante && (
                        <td className="small">
                          {e === 'pendente' && <span className="badge bg-info">{tx('À espera do Comandante desde {0}', { 0: dataHora(x.distribuicao.pedidoEm) })}</span>}
                          {e === 'devolvida' && <><span className="badge bg-warning text-dark">{tx('Mandada refazer pelo Comandante')}</span><div className="text-danger mt-1"><b>{tx('Recomendações:')}</b> {x.distribuicao.motivo}</div></>}
                          {e === 'rejeitada' && <><span className="badge bg-danger">{tx('Rejeitada pelo Comandante: faça uma lista nova')}</span><div className="text-danger mt-1"><b>{tx('Recomendações:')}</b> {x.distribuicao.motivo}</div></>}
                          {e === 'aprovada' && x.distribuicao.recomendacoes && <div className="mb-1"><b>{tx('Recomendações do Comandante:')}</b> {x.distribuicao.recomendacoes}</div>}
                          {e !== 'pendente' && (x.propostos ? <span className="badge bg-warning text-dark">{tx('Por enviar')}</span>
                            : x.semDocentes >= x.cadeiras ? <span className="badge bg-secondary">{tx('Por distribuir')}</span>
                              : e !== 'devolvida' && e !== 'rejeitada' && <span className="badge bg-success">{tx('Aprovada')}</span>)}
                        </td>
                      )}
                      <td className="text-end text-nowrap">
                        <Link to={`/academico/documentos/distribuicao?ano=${encodeURIComponent(x.anoLetivo)}`} className="btn btn-sm btn-white me-1"><i className="fa fa-print me-1" />{tx('Imprimir a lista')}</Link>
                        {d.aprovacaoComandante && aprova && e === 'pendente' && <Link to="/publicacoes" className="btn btn-sm btn-success"><i className="fa fa-check me-1" />{tx('Decidir')}</Link>}
                        {d.aprovacaoComandante && gere && !aprova && e !== 'pendente' && x.propostos > 0 && <button type="button" className="btn btn-sm btn-primary" onClick={() => enviar(x.anoLetivo, x.propostos)}><i className="fa fa-paper-plane me-1" />{tx('Enviar ao Comandante')}</button>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Painel>
      )}
      <div className="row">
        <div className="col-xl-5">
          <Painel titulo={tx('Carga horária por docente')} corpo={false}>
            <div className="list-group list-group-flush">
              {d.docentes.length === 0 && <div className="list-group-item text-muted">{tx('Ainda não há docentes registados: o registo é feito pela Repartição de Pessoal e Quadros.')}</div>}
              {d.docentes.map((x) => (
                <div key={x.docente.id} className="list-group-item">
                  <div className="d-flex justify-content-between align-items-baseline">
                    <span className="fw-bold">{x.docente.nome} {!x.docente.ativo && <span className="badge bg-secondary">{tx('Inactivo')}</span>}</span>
                    <span className="fw-bold">{x.horas} {tx('h')}</span>
                  </div>
                  <div className="progress my-1" style={{ height: 6 }}><div className="progress-bar bg-red" style={{ width: `${(x.horas / maxHoras) * 100}%` }} /></div>
                  <div className="small text-muted">
                    {x.cadeiras.length === 0 ? tx('Sem cadeiras') : x.cadeiras.map((c) => (
                      <Link key={c.id} to={`/academico/cadeiras/${c.id}?separador=docentes`} className="me-2 text-decoration-none">{c.codigo} <span className="text-muted">({PAPEIS_DOCENCIA[c.papel].toLowerCase()}, {c.horas} {tx('h)')}</span>{c.estado === 'proposta' && PROPOSTO}</Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Painel>
        </div>
        <div className="col-xl-7">
          <Painel
            titulo={tx('Cadeiras por turma')}
            corpo={false}
            acoes={(
              <div className="btn-group btn-group-sm">
                <button type="button" className={`btn ${filtro === 'todas' ? 'btn-light text-dark' : 'btn-outline-light'}`} onClick={() => setFiltro('todas')}>{tx('Todas')}</button>
                <button type="button" className={`btn ${filtro === 'sem-regente' ? 'btn-light text-dark' : 'btn-outline-light'}`} onClick={() => setFiltro('sem-regente')}>{tx('Sem regente (')}{semRegente.length})</button>
              </div>
            )}
          >
            {cadeiras.length === 0 && <div className="text-center text-muted py-4">{tx('Nada a mostrar.')}</div>}
            {porTurma.map(([turma, lista]) => {
              const aberta = abertas[turma.id] ?? porTurma.length === 1
              const sem = lista.filter((c) => c.docentes.length === 0).length
              const horas = lista.reduce((s2, c) => s2 + c.horasAlocadas, 0)
              const total = lista.reduce((s2, c) => s2 + c.horas, 0)
              return (
                <div key={turma.id} className="alocacao-turma">
                  <button type="button" className="alocacao-turma-cabeca" aria-expanded={aberta} onClick={() => setAbertas({ ...abertas, [turma.id]: !aberta })}>
                    <i className={`fa fa-chevron-${aberta ? 'down' : 'right'} me-2 text-muted`} />
                    <span className="flex-grow-1 text-start">
                      <strong>{turma.nome}</strong> <span className="text-muted small">{turma.anoLetivo}</span>
                      <span className="d-block small text-muted">{tx('{0} cadeira(s)', { 0: lista.length })}{sem > 0 && <span className="text-warning ms-2">· {tx('{0} sem docentes', { 0: sem })}</span>}</span>
                    </span>
                    <span className="alocacao-turma-horas">
                      <span className="small">{horas} / {total} {tx('h')}</span>
                      <span className="progress" style={{ height: 5, width: 110 }}><span className={`progress-bar ${horas >= total ? 'bg-success' : 'bg-warning'}`} style={{ width: `${total ? Math.min(100, (horas / total) * 100) : 0}%` }} /></span>
                    </span>
                  </button>
                  {aberta && (
                    <div className="table-responsive">
                      <table className="table table-sm table-striped align-middle mb-0">
                        <thead><tr><th>{tx('Cadeira')}</th><th>{tx('Semestre')}</th><th>{tx('Docentes')}</th><th className="text-end">{tx('Horas')}</th>{gere && <th />}</tr></thead>
                        <tbody>
                          {lista.map((c) => (
                            <tr key={c.id}>
                              <td><Link to={`/academico/cadeiras/${c.id}?separador=docentes`} className="text-decoration-none text-body"><span className="fw-bold">{c.codigo}</span> {c.nome}</Link></td>
                              <td className="small text-nowrap">
                                {PERIODOS[c.periodo]}
                                {(() => { const e = ESTADOS_PERIODO[estadoDoPeriodo(anoDe(c), String(c.periodo))]; return e && <div><span className={`badge ${e.cor}`}>{e.rotulo}</span></div> })()}
                              </td>
                              <td className="small">
                                {c.docentes.length === 0 ? <span className="badge bg-warning text-dark">{tx('Por alocar')}</span> : c.docentes.map((x) => (
                                  <div key={x.id}>{x.papel === 'regente' ? <i className="fa fa-star text-warning me-1" title={tx('Regente')} /> : <i className="fa fa-user text-muted me-1" title={tx('Assistente')} />}{x.nome}{x.estado === 'proposta' && PROPOSTO}</div>
                                ))}
                              </td>
                              <td className={`text-end text-nowrap ${c.horasAlocadas < c.horas ? 'text-warning' : ''}`}>{c.horasAlocadas} / {c.horas}</td>
                              {gere && <td className="text-end"><button type="button" className="btn btn-xs btn-primary" onClick={() => setAlocar(c)}>{tx('Alocar')}</button></td>}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
          </Painel>
        </div>
      </div>
      {alocar && <JanelaAlocar cadeira={alocar} onFechar={() => setAlocar(null)} onFeito={(texto) => { setAlocar(null); setAviso({ texto }); carregar() }} />}
      <Aviso aviso={aviso} onFechar={() => setAviso(null)} />
    </>
  )
}

/*
  Alocar numa cadeira de uma turma: os docentes do ano lectivo da turma (ou todos), o papel e as horas. Os que já
  lá estão ficam (podem tirar-se aqui). Grava-se a lista inteira da cadeira.
*/
function JanelaAlocar({ cadeira, onFechar, onFeito }) {
  const anoLetivo = cadeira.turma?.anoLetivo
  const [lista, setLista] = useState(cadeira.docentes.map((x) => ({ docenteId: x.id, nome: x.nome, papel: x.papel, horas: x.horas, estado: x.estado })))
  const [docentes, setDocentes] = useState(null)
  const [todosDocentes, setTodosDocentes] = useState(false)
  const [q, setQ] = useState('')
  const [erro, setErro] = useState('')
  const [aGravar, setAGravar] = useState(false)
  useEffect(() => {
    const filtro = !todosDocentes && anoLetivo ? `&anoLetivo=${encodeURIComponent(anoLetivo)}` : ''
    api(`/academico/contas?tipo=docente${filtro}`).then((l) => setDocentes(l.filter((x) => x.ativo !== false))).catch((e) => setErro(e.message))
  }, [anoLetivo, todosDocentes])
  const falta = Math.max(0, cadeira.horas - lista.reduce((s, x) => s + (Number(x.horas) || 0), 0))
  const juntar = (d) => setLista([...lista, { docenteId: d.id, nome: d.nome, papel: lista.some((x) => x.papel === 'regente') ? 'assistente' : 'regente', horas: falta || cadeira.horas, estado: null }])
  const mudar = (i, campo, v) => setLista(lista.map((x, k) => (k === i ? { ...x, [campo]: v } : x)))
  const termo = q.trim().toLowerCase()
  const escolhidos = new Set(lista.map((x) => x.docenteId))
  const opcoes = (docentes ?? []).filter((d) => !escolhidos.has(d.id) && (!termo || `${d.nome} ${d.numero ?? ''}`.toLowerCase().includes(termo))).slice(0, 12)
  const gravar = () => {
    setAGravar(true); setErro('')
    api(`/academico/cadeiras/${cadeira.id}/docentes`, { metodo: 'PUT', corpo: { docentes: lista.map((x) => ({ docenteId: x.docenteId, papel: x.papel, horas: Number(x.horas) || 0 })) } })
      .then(() => onFeito(tx('Docentes de {0} gravados.', { 0: cadeira.nome })))
      .catch((e) => { setErro(e.message); setAGravar(false) })
  }
  return (
    <Janela titulo={<>{tx('Alocar')} · {cadeira.nome}<div className="small text-muted fw-normal">{cadeira.turma?.nome} · {cadeira.horas} {tx('h')}</div></>} onFechar={onFechar} larga
      rodape={<><button type="button" className="btn btn-white" onClick={onFechar}>{tx('Cancelar')}</button><button type="button" className="btn btn-primary" disabled={aGravar} onClick={gravar}>{tx('Gravar')}</button></>}>
      {erro && <div className="alert alert-danger py-2">{erro}</div>}
      <h6>{tx('Docentes desta cadeira nesta turma')}</h6>
      {lista.length === 0 ? <p className="text-muted small">{tx('Ainda nenhum. Escolha abaixo.')}</p> : (
        <table className="table table-sm align-middle">
          <tbody>
            {lista.map((x, i) => (
              <tr key={x.docenteId}>
                <td>{x.nome}{x.estado === 'proposta' && PROPOSTO}</td>
                <td style={{ width: 150 }}><select className="form-select form-select-sm" value={x.papel} onChange={(e) => mudar(i, 'papel', e.target.value)}>{Object.entries(PAPEIS_DOCENCIA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></td>
                <td style={{ width: 110 }}><div className="input-group input-group-sm"><input type="number" min={0} className="form-control" value={x.horas} onChange={(e) => mudar(i, 'horas', e.target.value)} /><span className="input-group-text">{tx('h')}</span></div></td>
                <td className="text-end" style={{ width: 40 }}><button type="button" className="btn btn-xs btn-outline-danger" title={tx('Tirar')} onClick={() => setLista(lista.filter((_, k) => k !== i))}><i className="fa fa-times" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <h6 className="mt-3">{tx('Juntar um docente')}</h6>
      <div className="d-flex gap-2 align-items-center mb-2">
        <input className="form-control form-control-sm" placeholder={tx('Nome ou NIP')} value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
        <label className="form-check small text-nowrap mb-0"><input type="checkbox" className="form-check-input" checked={todosDocentes} onChange={(e) => { setDocentes(null); setTodosDocentes(e.target.checked) }} /> {tx('todos os anos')}</label>
      </div>
      {docentes === null ? <Carregando compacta /> : opcoes.length === 0 ? <p className="text-muted small">{tx('Nenhum docente encontrado.')}</p> : (
        <div className="list-group">
          {opcoes.map((d) => (
            <button key={d.id} type="button" className="list-group-item list-group-item-action py-1 d-flex justify-content-between" onClick={() => juntar(d)}>
              <span>{d.nome}</span><span className="text-muted small">{d.numero}</span>
            </button>
          ))}
        </div>
      )}
    </Janela>
  )
}

export default Alocacao
