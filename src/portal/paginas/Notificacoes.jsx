import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { Cartao, Carregando, Erro, Titulo } from '../componentes'
import { ICONES_NOTIFICACAO, dataHora, ha } from '../formatar'

// todas as notificações, com filtro e "mais antigas"
function Notificacoes() {
  const navegar = useNavigate()
  const [dados, setDados] = useState(null)
  const [soNovas, setSoNovas] = useState(false)
  const [erro, setErro] = useState('')
  const carregar = useCallback(() => api('/notificacoes').then(setDados).catch((e) => setErro(e.message)), [])
  useEffect(() => { carregar() }, [carregar])

  const mais = () => api(`/notificacoes?antesDe=${dados.lista.at(-1).id}`).then((r) => setDados({ ...dados, lista: [...dados.lista, ...r.lista] })).catch((e) => setErro(e.message))
  const lerTodas = () => api('/notificacoes/lidas', { metodo: 'PUT', corpo: { todas: true } }).then((r) => { setDados(r); window.dispatchEvent(new Event('portal-avisos')) }).catch((e) => setErro(e.message))
  async function seguir(n) {
    if (!n.lida) await api('/notificacoes/lidas', { metodo: 'PUT', corpo: { ids: [n.id] } }).catch(() => {})
    if (n.ligacao) navegar(n.ligacao)
    else carregar()
  }

  if (erro) return <Erro texto={erro} />
  if (!dados) return <Carregando />
  const lista = soNovas ? dados.lista.filter((n) => !n.lida) : dados.lista

  return (
    <>
      <Titulo rotulo="Notificações" titulo="Notificações" sub={dados.naoLidas ? `${dados.naoLidas} por ler` : 'tudo lido'}>
        {dados.naoLidas > 0 && <button type="button" className="btn btn-white" onClick={lerTodas}><i className="fa fa-check-double me-1" /> Marcar todas como lidas</button>}
      </Titulo>
      <Cartao
        titulo={<><i className="fa fa-bell me-2" />As minhas notificações</>}
        acoes={(
          <div className="btn-group btn-group-sm">
            <button type="button" className={`btn ${!soNovas ? 'btn-light text-dark' : 'btn-outline-light'}`} onClick={() => setSoNovas(false)}>Todas</button>
            <button type="button" className={`btn ${soNovas ? 'btn-light text-dark' : 'btn-outline-light'}`} onClick={() => setSoNovas(true)}>Por ler</button>
          </div>
        )}
        corpo={false}
      >
        {lista.length === 0 ? <div className="panel-body text-center text-muted py-5"><i className="fa fa-bell-slash fa-2x d-block mb-2 opacity-50" />Sem notificações.</div> : (
          <div className="list-group list-group-flush">
            {lista.map((n) => {
              const [icone, cor] = ICONES_NOTIFICACAO[n.tipo] || ICONES_NOTIFICACAO.geral
              return (
                <button key={n.id} type="button" className={`list-group-item list-group-item-action d-flex gap-3 text-start ${n.lida ? '' : 'p-notif-nova'}`} onClick={() => seguir(n)}>
                  <span className={`p-atividade-icone ${cor}`}><i className={`fa ${icone}`} /></span>
                  <span className="flex-grow-1 min-w-0">
                    <span className="d-block fw-bold">{n.titulo}</span>
                    {n.texto && <span className="d-block small">{n.texto}</span>}
                    <span className="d-block small text-muted" title={dataHora(n.criadaEm)}>{ha(n.criadaEm)}</span>
                  </span>
                  {!n.lida && <span className="badge bg-danger align-self-start">Nova</span>}
                </button>
              )
            })}
          </div>
        )}
        {!soNovas && dados.lista.length >= 30 && dados.lista.length % 30 === 0 && (
          <div className="panel-body text-center"><button type="button" className="btn btn-white btn-sm" onClick={mais}>Mais antigas</button></div>
        )}
      </Cartao>
    </>
  )
}

export default Notificacoes
