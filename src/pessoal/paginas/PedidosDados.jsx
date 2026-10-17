import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useSessao } from '../sessao'
import { useDados } from '../useDados'
import Foto from '../componentes/Foto'
import { Cabecalho, Carregando, Erro, Painel } from '../componentes/Ui'
import { dataHoraPt } from '../formatar'

const ESTADOS = { pendente: ['bg-warning text-dark', 'Por responder'], respondido: ['bg-success', 'Respondido'], recusado: ['bg-secondary', 'Recusado'] }

// pedidos das pessoas sobre os seus dados (Lei n.º 22/11), respondidos pela Repartição de Pessoal e Quadros
export default function PedidosDados() {
  const { avisar } = useSessao()
  const { dados, erro, recarregar } = useDados('/privacidade/pedidos')
  const [aberto, setAberto] = useState(null)
  const [resposta, setResposta] = useState('')
  const responder = (id, estado) => api(`/privacidade/pedidos/${id}`, { metodo: 'PUT', corpo: { estado, resposta } }).then(() => { setAberto(null); setResposta(''); avisar('Resposta registada: a pessoa vê-a na sua ficha.'); recarregar() }).catch((e) => avisar(e.message, 'erro'))
  if (erro) return <Erro texto={erro} />
  return (
    <>
      <Cabecalho titulo="Pedidos sobre dados pessoais" subtitulo="Lei n.º 22/11 — direitos dos titulares" migalhas={[['Administração'], ['Pedidos sobre dados']]} />
      <Painel corpo={false}>
        {!dados ? <div className="panel-body"><Carregando /></div> : (
          <div className="list-group list-group-flush">
            {!dados.length && <div className="list-group-item text-muted text-center py-4">Nenhum pedido.</div>}
            {dados.map((p) => (
              <div key={p.id} className="list-group-item">
                <div className="d-flex flex-wrap gap-2 align-items-center">
                  <span className={`badge ${ESTADOS[p.estado]?.[0]}`}>{ESTADOS[p.estado]?.[1]}</span>
                  <strong>{p.tipoNome}</strong>
                  <Link to={`/pessoas/${p.pessoa.id}`} className="pes-pessoa text-decoration-none small"><Foto pessoaId={p.pessoa.id} fotoId={p.pessoa.fotoId} nome={p.pessoa.nome} tamanho={24} />{p.pessoa.nome} · {p.pessoa.nip || p.pessoa.numeroAgente}</Link>
                  <span className="small text-muted ms-auto">{dataHoraPt(p.criadoEm)}</span>
                </div>
                <p className="mb-1 mt-2" style={{ whiteSpace: 'pre-wrap' }}>{p.texto}</p>
                {p.estado !== 'pendente' && <div className="small text-muted"><i className="fa fa-reply me-1" />{p.resposta} — {p.respondidoPor}, {dataHoraPt(p.respondidoEm)}</div>}
                {p.estado === 'pendente' && (aberto === p.id ? (
                  <div className="mt-2">
                    <textarea className="form-control mb-2" rows={3} value={resposta} onChange={(e) => setResposta(e.target.value)} placeholder="Resposta (o que foi corrigido, ou porque não é possível)" aria-label="Resposta" />
                    <button type="button" className="btn btn-sm btn-success me-1" disabled={resposta.trim().length < 3} onClick={() => responder(p.id, 'respondido')}>Responder</button>
                    <button type="button" className="btn btn-sm btn-outline-secondary me-1" disabled={resposta.trim().length < 3} onClick={() => responder(p.id, 'recusado')}>Recusar</button>
                    <button type="button" className="btn btn-sm btn-link" onClick={() => setAberto(null)}>Cancelar</button>
                  </div>
                ) : <button type="button" className="btn btn-sm btn-outline-secondary mt-1" onClick={() => { setAberto(p.id); setResposta('') }}><i className="fa fa-reply me-1" />Responder</button>)}
              </div>
            ))}
          </div>
        )}
      </Painel>
    </>
  )
}
