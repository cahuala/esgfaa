import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../../api'
import { Aviso, CabecalhoPagina, Carregando, Painel } from '../../componentes/Ui'
import { confirmar } from '../../../portal/dialogos'
import { descarregarCsv } from '../academico/documentos/csv'

const dia = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-PT') : '—')
const SEPARADORES = { ativos: 'Emprestados', atrasados: 'Em atraso', historico: 'Histórico' }

// balcão da biblioteca: emprestar e devolver pelo código do exemplar; listas e avisos de atraso
function Circulacao() {
  const [params, setParams] = useSearchParams()
  const estado = SEPARADORES[params.get('estado')] ? params.get('estado') : 'ativos'
  const [lista, setLista] = useState(null)
  const [aviso, setAviso] = useState(null)
  const falhou = useCallback((e) => setAviso({ tipo: 'erro', texto: e.message }), [])
  const carregar = useCallback(() => api(`/biblioteca/emprestimos?estado=${estado}`).then(setLista).catch(falhou), [estado, falhou])
  useEffect(() => { carregar() }, [carregar])

  const renovar = (e) => api(`/biblioteca/emprestimos/${e.id}/renovar`, { metodo: 'POST' }).then((r) => { setAviso({ texto: `Renovado até ${dia(r.prazo)}.` }); carregar() }).catch(falhou)
  async function devolver(e) {
    if (!(await confirmar(`Registar a devolução de "${e.exemplar.obra.titulo}" (${e.exemplar.codigo}) por ${e.leitor.nome}?`, { titulo: 'Devolução', botao: 'Devolvido' }))) return
    await api('/biblioteca/devolucoes', { metodo: 'POST', corpo: { id: e.id } }).then(() => { setAviso({ texto: 'Devolução registada.' }); carregar() }).catch(falhou)
  }
  async function avisarAtrasados() {
    if (!(await confirmar('Avisar no portal (e por e-mail, para quem o recebe) todos os leitores com livros fora do prazo?', { titulo: 'Avisar atrasos', botao: 'Avisar' }))) return
    await api('/biblioteca/avisar-atrasos', { metodo: 'POST' }).then((r) => setAviso({ texto: r.leitores ? `${r.leitores} leitor(es) avisado(s) de ${r.emprestimos} livro(s) em atraso.` : 'Não há livros em atraso.' })).catch(falhou)
  }
  const exportar = () => descarregarCsv(`biblioteca-${estado}`, [
    ['Código', 'Obra', 'Leitor', 'N.º', 'Emprestado', 'Prazo', 'Devolvido', 'Dias de atraso', 'Renovações'],
    ...lista.map((e) => [e.exemplar.codigo, e.exemplar.obra.titulo, e.leitor.nome, e.leitor.numero, dia(e.emprestadoEm), dia(e.prazo), dia(e.devolvidoEm), e.diasAtraso || '', e.renovacoes]),
  ])

  return (
    <>
      <CabecalhoPagina titulo="Empréstimos" subtitulo="balcão da biblioteca" migalhas={[{ rotulo: 'Biblioteca', para: '/biblioteca' }, { rotulo: 'Empréstimos' }]}>
        <button type="button" className="btn btn-white" onClick={avisarAtrasados}><i className="fa fa-bell me-1 text-danger" />Avisar atrasos</button>
      </CabecalhoPagina>
      <div className="row">
        <div className="col-lg-7"><Emprestar feito={(t) => { setAviso({ texto: t }); carregar() }} falhou={falhou} /></div>
        <div className="col-lg-5"><Devolver feito={(t) => { setAviso({ texto: t }); carregar() }} falhou={falhou} /></div>
      </div>
      <ul className="nav nav-tabs">
        {Object.entries(SEPARADORES).map(([k, v]) => (
          <li key={k} className="nav-item"><button type="button" className={`nav-link ${estado === k ? 'active' : ''}`} onClick={() => setParams(k === 'ativos' ? {} : { estado: k })}>{v}</button></li>
        ))}
      </ul>
      <Painel titulo={lista ? `${SEPARADORES[estado]} (${lista.length})` : SEPARADORES[estado]} corpo={false} acoes={lista?.length > 0 && <button type="button" className="btn btn-xs btn-white" onClick={exportar}><i className="fa fa-file-excel me-1 text-success" />Excel</button>}>
        {!lista ? <Carregando /> : (
          <div className="table-responsive">
            <table className="table table-striped align-middle mb-0">
              <thead><tr><th>Obra</th><th>Leitor</th><th>Emprestado</th><th>{estado === 'historico' ? 'Devolvido' : 'Prazo'}</th><th /></tr></thead>
              <tbody>
                {lista.length === 0 && <tr><td colSpan={5} className="text-center text-muted py-4">{estado === 'atrasados' ? 'Nenhum livro em atraso.' : 'Nada a mostrar.'}</td></tr>}
                {lista.map((e) => (
                  <tr key={e.id} className={e.emAtraso ? 'table-danger' : ''}>
                    <td><Link to={`/biblioteca/obras/${e.exemplar.obra.id}`} className="fw-bold text-body">{e.exemplar.obra.titulo}</Link><div className="small text-muted font-monospace">{e.exemplar.codigo}</div></td>
                    <td>{e.leitor.nome}<div className="small text-muted">{e.leitor.numero} · {e.leitor.tipo}</div></td>
                    <td className="small">{dia(e.emprestadoEm)}</td>
                    <td className="small">
                      {estado === 'historico' ? (e.devolvidoEm ? dia(e.devolvidoEm) : <span className="badge bg-info">Emprestado</span>) : <>{dia(e.prazo)}{e.renovacoes > 0 && <span className="text-muted"> · renovado {e.renovacoes}×</span>}</>}
                      {e.emAtraso && <span className="badge bg-danger ms-1">{e.diasAtraso} dia(s) de atraso</span>}
                    </td>
                    <td className="text-end text-nowrap">
                      {e.ativo && <button type="button" className="btn btn-xs btn-white me-1" disabled={!e.podeRenovar} onClick={() => renovar(e)} title={e.podeRenovar ? 'Renovar o prazo' : 'Já não se pode renovar'}><i className="fa fa-redo me-1" />Renovar</button>}
                      {e.ativo && <button type="button" className="btn btn-xs btn-theme" onClick={() => devolver(e)}><i className="fa fa-undo me-1" />Devolver</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Painel>
      <Aviso aviso={aviso} onFechar={() => setAviso(null)} />
    </>
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
    if (!leitor) return falhou(new Error('Escolha o leitor.'))
    setAEnviar(true)
    try {
      const r = await api('/biblioteca/emprestimos', { metodo: 'POST', corpo: { codigo, contaId: leitor.id } })
      feito(`"${r.exemplar.obra.titulo}" emprestado a ${r.leitor.nome} até ${dia(r.prazo)}.`)
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
    <Painel titulo={<><i className="fa fa-hand-holding me-2" />Emprestar</>}>
      <form onSubmit={enviar}>
        <div className="row g-2">
          <div className="col-md-5"><label className="form-label" htmlFor="emp-codigo">Código do exemplar</label><input id="emp-codigo" className="form-control font-monospace" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="BIB-000001" required /></div>
          <div className="col-md-7 position-relative">
            <label className="form-label" htmlFor="emp-leitor">Leitor</label>
            {leitor ? (
              <div className="form-control d-flex align-items-center gap-2">
                <span className="flex-grow-1 text-truncate"><b>{leitor.nome}</b> <span className="text-muted small">{leitor.numero}</span></span>
                <button type="button" className="btn-close btn-sm" onClick={() => setLeitor(null)} aria-label="Escolher outro leitor" />
              </div>
            ) : <input id="emp-leitor" className="form-control" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome, n.º ou e-mail" autoComplete="off" />}
            {!leitor && q.trim().length >= 2 && leitores.length > 0 && (
              <div className="list-group position-absolute w-100 shadow" style={{ zIndex: 10 }}>
                {leitores.map((l) => (
                  <button key={l.id} type="button" className="list-group-item list-group-item-action d-flex align-items-center gap-2" disabled={!l.ativo} onClick={() => setLeitor(l)}>
                    <span className="flex-grow-1">{l.nome}<span className="d-block small text-muted">{l.numero} · {l.tipo}</span></span>
                    <span className={`badge ${l.atrasados ? 'bg-danger' : l.emprestados >= l.maximo ? 'bg-warning text-dark' : 'bg-light text-dark border'}`}>{l.atrasados ? `${l.atrasados} em atraso` : `${l.emprestados}/${l.maximo}`}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <button type="submit" className="btn btn-theme mt-3" disabled={aEnviar}>{aEnviar ? 'A registar…' : 'Registar empréstimo'}</button>
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
      feito(`"${r.exemplar.obra.titulo}" devolvido por ${r.leitor.nome}${r.diasAtrasoNaDevolucao ? `, com ${r.diasAtrasoNaDevolucao} dia(s) de atraso` : ''}.`)
      setCodigo('')
    } catch (falha) {
      falhou(falha)
    }
  }
  return (
    <Painel titulo={<><i className="fa fa-undo me-2" />Devolver</>}>
      <form onSubmit={enviar}>
        <label className="form-label" htmlFor="dev-codigo">Código do exemplar</label>
        <div className="input-group">
          <input id="dev-codigo" className="form-control font-monospace" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="BIB-000001" required />
          <button type="submit" className="btn btn-theme">Devolver</button>
        </div>
        <div className="small text-muted mt-2">Pode usar um leitor de código de barras: o código entra no campo e o Enter regista.</div>
      </form>
    </Painel>
  )
}

export default Circulacao
