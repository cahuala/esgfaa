import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useSessao } from '../sessao'
import { useDados } from '../useDados'
import { dataHoraPt } from '../formatar'
import Foto from './Foto'
import { Painel } from './Ui'

const ICONE = { docente_novo: 'fa-chalkboard-teacher', docente_categoria: 'fa-layer-group', docente_saida: 'fa-user-minus', utilizador_novo: 'fa-user-shield', utilizador_papel: 'fa-user-tag' }
const COR = { deferido: 'text-success', indeferido: 'text-danger', anulado: 'text-muted' }

/*
  Pedidos que só valem depois do despacho do Comandante: docente novo, mudança de categoria, saída da lista
  dos docentes, contas do sistema e mudanças de papel. O Comandante defere ou indefere (com o motivo).
*/
export default function PedidosDespacho() {
  const { avisar } = useSessao()
  const { dados, recarregar } = useDados('/pedidos-despacho', undefined, { tempoReal: true })
  const [aberto, setAberto] = useState(null) // id do pedido com o despacho a escrever
  const [texto, setTexto] = useState('')
  const [aGravar, setAGravar] = useState(false)
  if (!dados) return null
  const pendentes = dados.filter((x) => x.estado === 'pendente')
  const decididos = dados.filter((x) => x.estado === 'deferido' || x.estado === 'indeferido').slice(0, 15)

  async function decidir(x, decisao) {
    if (decisao === 'indeferido' && texto.trim().length < 3) return avisar('Ao indeferir, escreva o motivo no despacho.', 'erro')
    setAGravar(true)
    try {
      await api(`/pedidos-despacho/${x.id}/decidir`, { metodo: 'POST', corpo: { decisao, despacho: texto } })
      avisar(`${x.tipoNome}: ${decisao === 'deferido' ? 'deferido' : 'indeferido'}.`)
      setAberto(null)
      setTexto('')
      recarregar()
    } catch (e) {
      avisar(e.message, 'erro')
    } finally {
      setAGravar(false)
    }
  }

  const alvo = (x) => x.pessoa
    ? <Link to={`/pessoas/${x.pessoa.id}`} className="d-inline-flex align-items-center gap-2 text-decoration-none" onClick={(e) => e.stopPropagation()}><Foto pessoaId={x.pessoa.id} fotoId={x.pessoa.fotoId} nome={x.pessoa.nome} /><span>Ver a ficha</span></Link>
    : null

  return (
    <>
      <Painel titulo={`Pedidos a despacho (${pendentes.length})`} icone="fa-user-check" corpo={false}>
        <div className="list-group list-group-flush">
          {pendentes.map((x) => (
            <div key={x.id} className="list-group-item">
              <div className="d-flex flex-wrap gap-2 align-items-center">
                <span className="badge bg-light text-dark border"><i className={`fa ${ICONE[x.tipo] ?? 'fa-stamp'} me-1`} />{x.tipoNome}</span>
                <span className="fw-bold flex-grow-1">{x.resumo}</span>
                {alvo(x)}
              </div>
              <div className="small text-muted mt-1">Pedido por {x.pedidoPor} · {dataHoraPt(x.pedidoEm)}</div>
              {aberto === x.id ? (
                <div className="mt-2">
                  <textarea className="form-control form-control-sm mb-2" rows={2} maxLength={2000} placeholder="Despacho (obrigatório ao indeferir: o motivo)" value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Despacho" autoFocus />
                  <div className="d-flex gap-2 flex-wrap">
                    <button type="button" className="btn btn-sm btn-success" disabled={aGravar} onClick={() => decidir(x, 'deferido')}><i className="fa fa-check me-1" />Deferir</button>
                    <button type="button" className="btn btn-sm btn-danger" disabled={aGravar} onClick={() => decidir(x, 'indeferido')}><i className="fa fa-times me-1" />Indeferir</button>
                    <button type="button" className="btn btn-sm btn-white" onClick={() => { setAberto(null); setTexto('') }}>Cancelar</button>
                  </div>
                </div>
              ) : (
                <button type="button" className="btn btn-sm btn-outline-theme mt-2" onClick={() => { setAberto(x.id); setTexto('') }}><i className="fa fa-stamp me-1" />Despachar</button>
              )}
            </div>
          ))}
          {!pendentes.length && <div className="list-group-item text-muted">Não há pedidos à espera de despacho.</div>}
        </div>
      </Painel>
      {decididos.length > 0 && (
        <Painel titulo="Pedidos despachados recentemente" icone="fa-check-double" corpo={false}>
          <div className="list-group list-group-flush">
            {decididos.map((x) => (
              <div key={x.id} className="list-group-item">
                <div className="d-flex flex-wrap gap-2 align-items-center">
                  <span className="badge bg-light text-dark border">{x.tipoNome}</span>
                  <span className="flex-grow-1">{x.resumo}</span>
                </div>
                <div className="small text-muted"><b className={COR[x.estado]}>{x.estadoNome}</b> por {x.decididoPor} · {dataHoraPt(x.decididoEm)}{x.despacho ? ` — ${x.despacho}` : ''}</div>
              </div>
            ))}
          </div>
        </Painel>
      )}
    </>
  )
}
