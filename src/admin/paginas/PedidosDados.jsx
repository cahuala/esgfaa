import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { Aviso, CabecalhoPagina, Carregando, Erro, Painel } from '../componentes/Ui'
import { dataHora } from '../formatar'
import { t as tx } from '../../i18n/linguas'

const ESTADOS = { pendente: ['bg-warning text-dark', 'Por responder'], respondido: ['bg-success', 'Respondido'], recusado: ['bg-secondary', 'Recusado'] }

/*
  Pedidos dos titulares sobre os seus dados (Lei n.º 22/11): acesso, rectificação, oposição, eliminação.
  Chegam do Portal Académico (Perfil → Os meus dados); a resposta fica no portal e a pessoa é avisada.
*/
export default function PedidosDados() {
  const [lista, setLista] = useState(null)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState(null)
  const [aberto, setAberto] = useState(null)
  const [resposta, setResposta] = useState('')
  const carregar = useCallback(() => api('/privacidade/pedidos').then(setLista).catch((e) => setErro(e.message)), [])
  useEffect(() => { carregar() }, [carregar])

  async function responder(id, estado) {
    try {
      await api(`/privacidade/pedidos/${id}`, { metodo: 'PUT', corpo: { estado, resposta } })
      setAberto(null)
      setResposta('')
      setAviso({ texto: tx('Resposta enviada. A pessoa é avisada no portal.') })
      carregar()
    } catch (e) {
      setAviso({ tipo: 'erro', texto: e.message })
    }
  }

  if (erro) return <Erro texto={erro} />
  return (
    <>
      <CabecalhoPagina titulo={tx('Pedidos sobre dados pessoais')} subtitulo={tx('Lei n.º 22/11 — direitos dos titulares')} migalhas={[{ rotulo: tx('Segurança') }, { rotulo: tx('Pedidos sobre dados pessoais') }]} />
      <Painel corpo={false}>
        {!lista ? <div className="panel-body"><Carregando /></div> : (
          <div className="list-group list-group-flush">
            {lista.length === 0 && <div className="list-group-item text-muted text-center py-4">{tx('Nenhum pedido.')}</div>}
            {lista.map((p) => (
              <div key={p.id} className="list-group-item">
                <div className="d-flex flex-wrap gap-2 align-items-center">
                  <span className={`badge ${ESTADOS[p.estado]?.[0]}`}>{tx(ESTADOS[p.estado]?.[1] ?? p.estado)}</span>
                  <strong>{tx(p.tipoNome)}</strong>
                  <span className="text-muted small">{p.conta.nome} · {p.conta.email} · n.º {p.conta.numero}</span>
                  <span className="text-muted small ms-auto">{dataHora(p.criadoEm)}</span>
                </div>
                <p className="mb-1 mt-2" style={{ whiteSpace: 'pre-wrap' }}>{p.texto}</p>
                {p.estado !== 'pendente' && <div className="small text-muted"><i className="fa fa-reply me-1" />{p.resposta} — {p.respondidoPor}, {dataHora(p.respondidoEm)}</div>}
                {p.estado === 'pendente' && (aberto === p.id ? (
                  <div className="mt-2">
                    <textarea className="form-control mb-2" rows={3} value={resposta} onChange={(e) => setResposta(e.target.value)} placeholder={tx('Resposta à pessoa (o que foi feito, ou porque não é possível)')} aria-label={tx('Resposta')} />
                    <button type="button" className="btn btn-sm btn-success me-1" disabled={resposta.trim().length < 3} onClick={() => responder(p.id, 'respondido')}><i className="fa fa-check me-1" />{tx('Responder')}</button>
                    <button type="button" className="btn btn-sm btn-white me-1" disabled={resposta.trim().length < 3} onClick={() => responder(p.id, 'recusado')}>{tx('Recusar')}</button>
                    <button type="button" className="btn btn-sm btn-link" onClick={() => setAberto(null)}>{tx('Cancelar')}</button>
                  </div>
                ) : <button type="button" className="btn btn-sm btn-white mt-1" onClick={() => { setAberto(p.id); setResposta('') }}><i className="fa fa-reply me-1" />{tx('Responder')}</button>)}
              </div>
            ))}
          </div>
        )}
      </Painel>
      <p className="small text-muted">{tx('Para corrigir dados de uma conta do portal, use o registo de estudantes e docentes (ou o sistema de pessoal, que envia as alterações para o portal).')}</p>
      <Aviso aviso={aviso} onFechar={() => setAviso(null)} />
    </>
  )
}
