import { Fragment, useCallback, useEffect, useState } from 'react'
import { abrirFicheiro, api } from '../../api'
import { useSessao } from '../../sessaoContexto'
import { Aviso, CabecalhoPagina, Carregando, Erro, Painel } from '../../componentes/Ui'
import { dataHora } from '../../formatar'

const ESTADOS = { pendente: ['bg-secondary', 'Pendente'], em_tratamento: ['bg-warning text-dark', 'Em tratamento'], pronto: ['bg-success', 'Pronto'], recusado: ['bg-danger', 'Recusado'] }

// pedidos de documentos feitos pelos estudantes no portal
function Pedidos() {
  const { pode } = useSessao()
  const [lista, setLista] = useState(null)
  const [erro, setErro] = useState('')
  const [estado, setEstado] = useState('')
  const [aberto, setAberto] = useState(null)
  const [aviso, setAviso] = useState(null)

  const carregar = useCallback(() => api(`/academico/pedidos${estado ? `?estado=${estado}` : ''}`).then((r) => { setErro(''); setLista(r) }).catch((e) => setErro(e.message)), [estado])
  useEffect(() => { carregar() }, [carregar])

  return (
    <>
      <CabecalhoPagina titulo="Pedidos de documentos" subtitulo="feitos no portal" migalhas={[{ rotulo: 'Secretaria Académica' }, { rotulo: 'Pedidos' }]} />
      {erro && <Erro texto={erro} onRepetir={carregar} />}
      <Painel titulo={`Pedidos${lista ? ` (${lista.length})` : ''}`} corpo={false}>
        <div className="panel-body pb-0">
          <select className="form-select w-auto" value={estado} onChange={(e) => setEstado(e.target.value)} aria-label="Estado">
            <option value="">Todos os estados</option>
            {Object.entries(ESTADOS).map(([k, [, v]]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        {!lista && !erro ? <Carregando /> : (
          <div className="table-responsive mt-3">
            <table className="table table-striped align-middle mb-0">
              <thead><tr><th>Estudante</th><th>Documento</th><th>Pedido em</th><th>Estado</th><th /></tr></thead>
              <tbody>
                {lista?.length === 0 && <tr><td colSpan={5} className="text-center text-muted py-4">Sem pedidos.</td></tr>}
                {lista?.map((p) => (
                  <Fragment key={p.id}>
                    <tr>
                      <td><span className="fw-bold">{p.estudante.nome}</span><div className="small text-muted">{p.estudante.numero}</div></td>
                      <td>{p.tipo}{p.motivo && <div className="small text-muted texto-comentario">{p.motivo}</div>}</td>
                      <td className="text-nowrap">{dataHora(p.criadoEm)}</td>
                      <td><span className={`badge ${ESTADOS[p.estado][0]}`}>{ESTADOS[p.estado][1]}</span></td>
                      <td className="text-end">{pode('academico.gerir') && <button type="button" className="btn btn-sm btn-primary" onClick={() => setAberto(aberto === p.id ? null : p.id)}>{aberto === p.id ? 'Fechar' : 'Tratar'}</button>}</td>
                    </tr>
                    {aberto === p.id && (
                      <tr><td colSpan={5}><TratarPedido p={p} aoGuardar={() => { setAberto(null); setAviso({ texto: 'Pedido atualizado.' }); carregar() }} avisar={setAviso} /></td></tr>
                    )}
                  </Fragment>
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

function TratarPedido({ p, aoGuardar, avisar }) {
  const [f, setF] = useState({ estado: p.estado, resposta: p.resposta || '' })
  const [ficheiro, setFicheiro] = useState(null)
  const [aGuardar, setAGuardar] = useState(false)

  async function guardar(e) {
    e.preventDefault()
    setAGuardar(true)
    try {
      const fd = new FormData()
      fd.append('estado', f.estado)
      fd.append('resposta', f.resposta)
      if (ficheiro) fd.append('ficheiro', ficheiro)
      await api(`/academico/pedidos/${p.id}`, { metodo: 'PUT', formulario: fd })
      aoGuardar()
    } catch (falha) {
      avisar({ tipo: 'erro', texto: falha.message })
    } finally {
      setAGuardar(false)
    }
  }

  return (
    <form className="row g-2 align-items-end" onSubmit={guardar}>
      <div className="col-md-3">
        <label className="form-label fw-bold" htmlFor={`pe-${p.id}`}>Estado</label>
        <select id={`pe-${p.id}`} className="form-select" value={f.estado} onChange={(e) => setF({ ...f, estado: e.target.value })}>
          {Object.entries(ESTADOS).map(([k, [, v]]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <div className="col-md-5">
        <label className="form-label fw-bold" htmlFor={`pr-${p.id}`}>Resposta ao estudante</label>
        <input id={`pr-${p.id}`} className="form-control" value={f.resposta} onChange={(e) => setF({ ...f, resposta: e.target.value })} placeholder="Ex.: pode levantar na Secretaria a partir de…" />
      </div>
      <div className="col-md-3">
        <label className="form-label fw-bold" htmlFor={`pf-${p.id}`}>Documento (PDF)</label>
        <input id={`pf-${p.id}`} type="file" accept="application/pdf" className="form-control" onChange={(e) => setFicheiro(e.target.files[0] || null)} />
        {p.ficheiroId && <button type="button" className="btn btn-link btn-sm p-0" onClick={() => abrirFicheiro(p.ficheiroId, `${p.tipo}.pdf`).catch((x) => avisar({ tipo: 'erro', texto: x.message }))}>Ver o documento atual</button>}
      </div>
      <div className="col-md-1"><button type="submit" className="btn btn-theme w-100" disabled={aGuardar}>Guardar</button></div>
    </form>
  )
}

export default Pedidos
