import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { useSessao } from '../../sessaoContexto'
import { Aviso, CabecalhoPagina, Carregando, Erro, Painel } from '../../componentes/Ui'
import { dataHora } from '../../formatar'
import { ESTADOS_PERIODO, PAPEIS_DOCENCIA, PERIODOS, estadoDoPeriodo } from './comum'
import { t as tx } from '../../../i18n/linguas'

const PROPOSTO = <span className="badge bg-warning text-dark ms-1">{tx('proposto')}</span>

/*
  Alocação de docentes: carga horária de cada docente e cadeiras por alocar (turmas ativas). Quem o Ensino põe
  numa cadeira fica «proposto» (sem acesso) até o Comandante aprovar a distribuição da turma, que o Ensino lhe
  envia aqui depois de rever a lista. As cadeiras aparecem agrupadas por turma (abre-se a turma que se quer).
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
  const enviar = (t) => {
    if (!window.confirm(tx('Enviar ao Comandante a distribuição dos docentes de «{0}»? Os docentes propostos só têm a cadeira (e a conta) depois de ele aprovar.', { 0: t.nome }))) return
    api(`/academico/turmas/${t.id}/distribuicao`, { metodo: 'POST' })
      .then((r) => { setAviso({ texto: tx('Enviada ao Comandante ({0} docente(s) propostos).', { 0: r.propostos }) }); carregar() })
      .catch((e) => setAviso({ tipo: 'erro', texto: e.message }))
  }
  const [filtro, setFiltro] = useState('todas')
  // filtros: o ano letivo (o atual por omissão) e o semestre em que a cadeira é dada
  const [anos, setAnos] = useState([])
  const [ano, setAno] = useState('')
  const [semestre, setSemestre] = useState('')
  useEffect(() => { carregar() }, [])
  useEffect(() => { api('/academico/anos-letivos').then((l) => { setAnos(l); setAno(l.find((a) => a.atual)?.id ?? '') }).catch(() => {}) }, [])

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

  const widgets = [
    ['bg-dark', 'fa-chalkboard-teacher', tx('DOCENTES'), d.docentes.length, tx('{0} com cadeiras', { 0: d.docentes.filter((x) => x.cadeiras.length).length })],
    ['bg-red', 'fa-book', tx('CADEIRAS (TURMAS ACTIVAS)'), doFiltro.length, tx('{0} sem docentes', { 0: semDocentes.length })],
    ['bg-orange', 'fa-user-clock', tx('SEM REGENTE'), semRegente.length, tx('precisam de alocação')],
    ['bg-teal', 'fa-clock', tx('HORAS ALOCADAS'), horasTotal, tx('em todas as cadeiras')],
  ]

  return (
    <>
      <CabecalhoPagina titulo={tx('Alocação de docentes')} subtitulo={tx('regentes, assistentes e carga horária')} migalhas={[{ rotulo: tx('Administração Escolar') }, { rotulo: tx('Alocação de docentes') }]} />
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
          <div>{tx('Quem distribui os docentes pelas cadeiras é a Direcção de Ensino (Repartição de Administração Escolar). Depois de rever cada turma, envia-a ao Comandante, que a aprova ou devolve em')} <Link to="/publicacoes" className="fw-bold">{tx('Por aprovar')}</Link>. {tx('Aqui só se consulta.')}</div>
        </div>
      )}
      {d.aprovacaoComandante && d.turmas.length > 0 && (
        <Painel titulo={tx('Distribuição de serviço docente: aprovação do Comandante')} corpo={false}>
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead><tr><th>{tx('Turma')}</th><th>{tx('Cadeiras')}</th><th>{tx('Docentes propostos')}</th><th>{tx('Estado')}</th><th /></tr></thead>
              <tbody>
                {d.turmas.filter((t) => !ano || t.anoLetivo === ano).map((t) => {
                  const e = t.distribuicao?.estado
                  return (
                    <tr key={t.id}>
                      <td className="fw-bold">{t.nome}<div className="small text-muted fw-normal">{t.anoLetivo}</div></td>
                      <td>{t.cadeiras}{t.semDocentes > 0 && <div className="small text-warning">{tx('{0} sem docentes', { 0: t.semDocentes })}</div>}</td>
                      <td>{t.propostos}</td>
                      <td className="small">
                        {e === 'pendente' && <span className="badge bg-info">{tx('À espera do Comandante desde {0}', { 0: dataHora(t.distribuicao.pedidoEm) })}</span>}
                        {e === 'devolvida' && <><span className="badge bg-warning text-dark">{tx('Mandada refazer pelo Comandante')}</span><div className="text-danger mt-1"><b>{tx('Recomendações:')}</b> {t.distribuicao.motivo}</div></>}
                        {e === 'rejeitada' && <><span className="badge bg-danger">{tx('Rejeitada pelo Comandante: faça uma lista nova')}</span><div className="text-danger mt-1"><b>{tx('Recomendações:')}</b> {t.distribuicao.motivo}</div></>}
                        {e === 'aprovada' && <>{!t.propostos && <span className="badge bg-success">{tx('Aprovada')}</span>}{t.distribuicao.recomendacoes && <div className="mt-1"><b>{tx('Recomendações do Comandante:')}</b> {t.distribuicao.recomendacoes}</div>}</>}
                        {(!e || (e === 'aprovada' && t.propostos)) && (t.propostos ? <span className="badge bg-warning text-dark">{tx('Por enviar')}</span>
                          : t.semDocentes >= t.cadeiras ? <span className="badge bg-secondary">{tx('Por distribuir')}</span>
                            : <span className="badge bg-success">{tx('Aprovada')}</span>)}
                      </td>
                      <td className="text-end">{aprova && t.propostos > 0 && <Link to="/publicacoes" className="btn btn-sm btn-success me-1"><i className="fa fa-check me-1" />{tx('Aprovar')}</Link>}{gere && !aprova && e !== 'pendente' && t.propostos > 0 && <button type="button" className="btn btn-sm btn-primary" onClick={() => enviar(t)}><i className="fa fa-paper-plane me-1" />{tx('Enviar ao Comandante')}</button>}</td>
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
                              {gere && <td className="text-end"><Link to={`/academico/cadeiras/${c.id}?separador=docentes`} className="btn btn-xs btn-primary">{tx('Alocar')}</Link></td>}
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
      <Aviso aviso={aviso} onFechar={() => setAviso(null)} />
    </>
  )
}

export default Alocacao
