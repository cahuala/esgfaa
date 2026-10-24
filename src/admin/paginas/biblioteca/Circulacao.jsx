import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../../api'
import { Aviso, CabecalhoPagina, Carregando, Painel } from '../../componentes/Ui'
import { confirmar } from '../../../portal/dialogos'
import { descarregarCsv } from '../academico/documentos/csv'
import Capa from '../../../portal/biblioteca/Capa'
import { t as tx, localAtual } from '../../../i18n/linguas'

const dia = (iso) => (iso ? new Date(iso).toLocaleDateString(localAtual()) : '—')
const SEPARADORES = { ativos: tx('Emprestados'), atrasados: tx('Em atraso'), reservas: tx('Reservas'), historico: tx('Histórico') }

// balcão da biblioteca: emprestar e devolver pelo código do exemplar; listas e avisos de atraso
function Circulacao() {
  const [params, setParams] = useSearchParams()
  const estado = SEPARADORES[params.get('estado')] ? params.get('estado') : 'ativos'
  const [lista, setLista] = useState(null)
  const [aviso, setAviso] = useState(null)
  const falhou = useCallback((e) => setAviso({ tipo: 'erro', texto: e.message }), [])
  const [reservas, setReservas] = useState(null)
  const carregar = useCallback(() => {
    api('/biblioteca/reservas').then(setReservas).catch(falhou)
    if (estado !== 'reservas') api(`/biblioteca/emprestimos?estado=${estado}`).then(setLista).catch(falhou)
  }, [estado, falhou])
  useEffect(() => { carregar() }, [carregar])

  const renovar = (e) => api(`/biblioteca/emprestimos/${e.id}/renovar`, { metodo: 'POST' }).then((r) => { setAviso({ texto: tx('Renovado até {0}.', { 0: dia(r.prazo) }) }); carregar() }).catch(falhou)
  async function devolver(e) {
    if (!(await confirmar(tx('Registar a devolução de "{0}" ({1}) por {2}?', { 0: e.exemplar.obra.titulo, 1: e.exemplar.codigo, 2: e.leitor.nome }), { titulo: tx('Devolução'), botao: tx('Devolvido') }))) return
    await api('/biblioteca/devolucoes', { metodo: 'POST', corpo: { id: e.id } }).then(() => { setAviso({ texto: tx('Devolução registada.') }); carregar() }).catch(falhou)
  }
  async function avisarAtrasados() {
    if (!(await confirmar(tx('Avisar no portal (e por e-mail, para quem o recebe) todos os leitores com livros fora do prazo?'), { titulo: tx('Avisar atrasos'), botao: tx('Avisar') }))) return
    await api('/biblioteca/avisar-atrasos', { metodo: 'POST' }).then((r) => setAviso({ texto: r.leitores ? tx('{0} leitor(es) avisado(s) de {1} livro(s) em atraso.', { 0: r.leitores, 1: r.emprestimos }) : tx('Não há livros em atraso.') })).catch(falhou)
  }
  const exportar = () => descarregarCsv(`biblioteca-${estado}`, [
    ['Código', 'Obra', 'Leitor', 'N.º', 'Emprestado', 'Prazo', 'Devolvido', 'Dias de atraso', 'Renovações'],
    ...lista.map((e) => [e.exemplar.codigo, e.exemplar.obra.titulo, e.leitor.nome, e.leitor.numero, dia(e.emprestadoEm), dia(e.prazo), dia(e.devolvidoEm), e.diasAtraso || '', e.renovacoes]),
  ])

  return (
    <>
      <CabecalhoPagina titulo={tx('Empréstimos')} subtitulo={tx('balcão da biblioteca')} migalhas={[{ rotulo: tx('Biblioteca'), para: '/biblioteca' }, { rotulo: tx('Empréstimos') }]}>
        <button type="button" className="btn btn-white" onClick={avisarAtrasados}><i className="fa fa-bell me-1 text-danger" />{tx('Avisar atrasos')}</button>
      </CabecalhoPagina>
      <div className="row">
        <div className="col-lg-7"><Emprestar feito={(t) => { setAviso({ texto: t }); carregar() }} falhou={falhou} /></div>
        <div className="col-lg-5"><Devolver feito={(t) => { setAviso({ texto: t }); carregar() }} falhou={falhou} /></div>
      </div>
      <ul className="nav nav-tabs">
        {Object.entries(SEPARADORES).map(([k, v]) => (
          <li key={k} className="nav-item"><button type="button" className={`nav-link ${estado === k ? 'active' : ''}`} onClick={() => setParams(k === 'ativos' ? {} : { estado: k })}>{v}{k === 'reservas' && reservas?.length > 0 && <span className="badge bg-purple ms-1">{reservas.length}</span>}</button></li>
        ))}
      </ul>
      {estado === 'reservas' ? <Reservas l={reservas} recarregar={carregar} avisar={setAviso} falhou={falhou} /> : (
      <Painel titulo={lista ? `${SEPARADORES[estado]} (${lista.length})` : SEPARADORES[estado]} corpo={false} acoes={lista?.length > 0 && <button type="button" className="btn btn-xs btn-white" onClick={exportar}><i className="fa fa-file-excel me-1 text-success" />{tx('Excel')}</button>}>
        {!lista ? <Carregando /> : (
          <div className="table-responsive">
            <table className="table table-striped align-middle mb-0">
              <thead><tr><th>{tx('Obra')}</th><th>{tx('Leitor')}</th><th>{tx('Emprestado')}</th><th>{estado === 'historico' ? tx('Devolvido') : tx('Prazo')}</th><th /></tr></thead>
              <tbody>
                {lista.length === 0 && <tr><td colSpan={5} className="text-center text-muted py-4">{estado === 'atrasados' ? tx('Nenhum livro em atraso.') : tx('Nada a mostrar.')}</td></tr>}
                {lista.map((e) => (
                  <tr key={e.id} className={e.emAtraso ? 'table-danger' : ''}>
                    <td><Link to={`/biblioteca/obras/${e.exemplar.obra.id}`} className="fw-bold text-body" translate="no">{e.exemplar.obra.titulo}</Link><div className="small text-muted font-monospace">{e.exemplar.codigo}</div></td>
                    <td>{e.leitor.nome}<div className="small text-muted">{e.leitor.numero} · {tx(e.leitor.tipo)}</div></td>
                    <td className="small">{dia(e.emprestadoEm)}</td>
                    <td className="small">
                      {estado === 'historico' ? (e.devolvidoEm ? dia(e.devolvidoEm) : <span className="badge bg-info">{tx('Emprestado')}</span>) : <>{dia(e.prazo)}{e.renovacoes > 0 && <span className="text-muted"> {tx('· renovado')} {e.renovacoes}×</span>}</>}
                      {e.emAtraso && <span className="badge bg-danger ms-1">{e.diasAtraso} {tx('dia(s) de atraso')}</span>}
                    </td>
                    <td className="text-end text-nowrap">
                      {e.ativo && <button type="button" className="btn btn-xs btn-white me-1" disabled={!e.podeRenovar} onClick={() => renovar(e)} title={e.podeRenovar ? tx('Renovar o prazo') : tx('Já não se pode renovar')}><i className="fa fa-redo me-1" />{tx('Renovar')}</button>}
                      {e.ativo && <button type="button" className="btn btn-xs btn-theme" onClick={() => devolver(e)}><i className="fa fa-undo me-1" />{tx('Devolver')}</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Painel>
      )}
      <Aviso aviso={aviso} onFechar={() => setAviso(null)} />
    </>
  )
}

// reservas feitas no portal: separar o livro (o leitor é avisado), emprestar quando vem levantar, ou cancelar
function Reservas({ l, recarregar, avisar, falhou }) {
  const preparar = (r) => api(`/biblioteca/reservas/${r.id}/preparar`, { metodo: 'POST' }).then(() => { avisar({ texto: tx('{0} foi avisado de que o livro está pronto a levantar.', { 0: r.leitor.nome }) }); recarregar() }).catch(falhou)
  async function emprestar(r) {
    const codigo = r.naEstante[0]?.codigo
    if (!(await confirmar(tx('Emprestar "{0}" ({1}) a {2}?', { 0: r.obra.titulo, 1: codigo, 2: r.leitor.nome }), { titulo: tx('Levantamento'), botao: tx('Emprestar') }))) return
    await api('/biblioteca/emprestimos', { metodo: 'POST', corpo: { codigo, contaId: r.leitor.id } }).then((e) => { avisar({ texto: tx('Emprestado até {0}. Reserva atendida.', { 0: dia(e.prazo) }) }); recarregar() }).catch(falhou)
  }
  async function cancelar(r) {
    if (!(await confirmar(tx('Cancelar a reserva de "{0}" feita por {1}? O leitor é avisado.', { 0: r.obra.titulo, 1: r.leitor.nome }), { titulo: tx('Cancelar reserva'), botao: tx('Cancelar reserva'), perigo: true }))) return
    await api(`/biblioteca/reservas/${r.id}/cancelar`, { metodo: 'POST' }).then(recarregar).catch(falhou)
  }
  return (
    <Painel titulo={l ? tx('Reservas ({0})', { 0: l.length }) : tx('Reservas')} corpo={false}>
      {!l ? <Carregando /> : (
        <div className="table-responsive">
          <table className="table align-middle mb-0">
            <thead><tr><th>{tx('Obra')}</th><th>{tx('Leitor')}</th><th>{tx('Pedida')}</th><th>{tx('Estado')}</th><th>{tx('Na estante')}</th><th /></tr></thead>
            <tbody>
              {l.length === 0 && <tr><td colSpan={6} className="text-center text-muted py-4">{tx('Não há reservas por atender.')}</td></tr>}
              {l.map((r) => (
                <tr key={r.id} className={r.expirada ? 'table-warning' : ''}>
                  <td>
                    <div className="d-flex align-items-center gap-2">
                      <div style={{ width: 34, flex: '0 0 34px' }}><Capa o={r.obra} /></div>
                      <div><Link to={`/biblioteca/obras/${r.obra.id}`} className="fw-bold text-body" translate="no">{r.obra.titulo}</Link><div className="small text-muted" translate="no">{r.obra.cota}</div></div>
                    </div>
                  </td>
                  <td>{r.leitor.nome}<div className="small text-muted">{r.leitor.numero}</div></td>
                  <td className="small">{dia(r.criadaEm)}</td>
                  <td>
                    {r.estado === 'pendente' ? <span className="badge bg-warning text-dark">{tx('Por separar')}</span> : <span className="badge bg-purple">{tx('Separado até')} {dia(r.levantarAte)}</span>}
                    {r.expirada && <div className="small text-danger">{tx('Prazo para levantar passou')}</div>}
                  </td>
                  <td className="small">{r.naEstante.length ? r.naEstante.map((x) => <div key={x.codigo}><span className="font-monospace">{x.codigo}</span>{x.localizacao && <span className="text-muted"> · {x.localizacao}</span>}</div>) : <span className="text-muted">{tx('todos emprestados')}</span>}</td>
                  <td className="text-end text-nowrap">
                    {r.estado === 'pendente' && <button type="button" className="btn btn-xs btn-white me-1" disabled={!r.naEstante.length} onClick={() => preparar(r)} title={tx('Separar o livro e avisar o leitor')}><i className="fa fa-box me-1" />{tx('Separar')}</button>}
                    <button type="button" className="btn btn-xs btn-theme me-1" disabled={!r.naEstante.length} onClick={() => emprestar(r)}><i className="fa fa-hand-holding me-1" />{tx('Emprestar')}</button>
                    <button type="button" className="btn btn-xs btn-white text-danger" onClick={() => cancelar(r)} aria-label={tx('Cancelar reserva')}><i className="fa fa-times" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Painel>
  )
}

// emprestar: código do exemplar (lido com o leitor de código de barras ou escrito) e o leitor
function Emprestar({ feito, falhou }) {
  const [codigo, setCodigo] = useState('')
  const [q, setQ] = useState('')
  const [leitores, setLeitores] = useState([])
  const [leitor, setLeitor] = useState(null)
  const [aEnviar, setAEnviar] = useState(false)
  useEffect(() => {
    if (leitor || q.trim().length < 2) return undefined
    const t = setTimeout(() => api(`/biblioteca/leitores?q=${encodeURIComponent(q)}`).then(setLeitores).catch(falhou), 250)
    return () => clearTimeout(t)
  }, [q, leitor, falhou])
  async function enviar(e) {
    e.preventDefault()
    if (!leitor) return falhou(new Error(tx('Escolha o leitor.')))
    setAEnviar(true)
    try {
      const r = await api('/biblioteca/emprestimos', { metodo: 'POST', corpo: { codigo, contaId: leitor.id } })
      feito(tx('"{0}" emprestado a {1} até {2}.', { 0: r.exemplar.obra.titulo, 1: r.leitor.nome, 2: dia(r.prazo) }))
      setCodigo('')
      setLeitor(null)
      setQ('')
      setLeitores([])
    } catch (falha) {
      falhou(falha)
    } finally {
      setAEnviar(false)
    }
  }
  return (
    <Painel titulo={<><i className="fa fa-hand-holding me-2" />{tx('Emprestar')}</>}>
      <form onSubmit={enviar}>
        <div className="row g-2">
          <div className="col-md-5"><label className="form-label" htmlFor="emp-codigo">{tx('Código do exemplar')}</label><input id="emp-codigo" className="form-control font-monospace" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder={tx('BIB-000001')} required /></div>
          <div className="col-md-7 position-relative">
            <label className="form-label" htmlFor="emp-leitor">{tx('Leitor')}</label>
            {leitor ? (
              <div className="form-control d-flex align-items-center gap-2">
                <span className="flex-grow-1 text-truncate"><b>{leitor.nome}</b> <span className="text-muted small">{leitor.numero}</span></span>
                <button type="button" className="btn-close btn-sm" onClick={() => setLeitor(null)} aria-label={tx('Escolher outro leitor')} />
              </div>
            ) : <input id="emp-leitor" className="form-control" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tx('Nome, n.º ou e-mail')} autoComplete="off" />}
            {!leitor && q.trim().length >= 2 && leitores.length > 0 && (
              <div className="list-group position-absolute w-100 shadow" style={{ zIndex: 10 }}>
                {leitores.map((l) => (
                  <button key={l.id} type="button" className="list-group-item list-group-item-action d-flex align-items-center gap-2" disabled={!l.ativo} onClick={() => setLeitor(l)}>
                    <span className="flex-grow-1">{l.nome}<span className="d-block small text-muted">{l.numero} · {tx(l.tipo)}</span></span>
                    <span className={`badge ${l.atrasados ? 'bg-danger' : l.emprestados >= l.maximo ? 'bg-warning text-dark' : 'bg-light text-dark border'}`}>{l.atrasados ? tx('{0} em atraso', { 0: l.atrasados }) : `${l.emprestados}/${l.maximo}`}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <button type="submit" className="btn btn-theme mt-3" disabled={aEnviar}>{aEnviar ? tx('A registar…') : tx('Registar empréstimo')}</button>
      </form>
    </Painel>
  )
}

function Devolver({ feito, falhou }) {
  const [codigo, setCodigo] = useState('')
  async function enviar(e) {
    e.preventDefault()
    try {
      const r = await api('/biblioteca/devolucoes', { metodo: 'POST', corpo: { codigo } })
      feito(tx('"{0}" devolvido por {1}{2}.', { 0: r.exemplar.obra.titulo, 1: r.leitor.nome, 2: r.diasAtrasoNaDevolucao ? `, com ${r.diasAtrasoNaDevolucao} dia(s) de atraso` : '' }))
      setCodigo('')
    } catch (falha) {
      falhou(falha)
    }
  }
  return (
    <Painel titulo={<><i className="fa fa-undo me-2" />{tx('Devolver')}</>}>
      <form onSubmit={enviar}>
        <label className="form-label" htmlFor="dev-codigo">{tx('Código do exemplar')}</label>
        <div className="input-group">
          <input id="dev-codigo" className="form-control font-monospace" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder={tx('BIB-000001')} required />
          <button type="submit" className="btn btn-theme">{tx('Devolver')}</button>
        </div>
        <div className="small text-muted mt-2">{tx('Pode usar um leitor de código de barras: o código entra no campo e o Enter regista.')}</div>
      </form>
    </Painel>
  )
}

export default Circulacao
