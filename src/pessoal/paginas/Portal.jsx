import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useSessao } from '../sessao'
import { Cabecalho, Carregando, Painel } from '../componentes/Ui'
import { dataHoraPt } from '../formatar'

// ligação ao Portal Académico: só sai daqui o necessário para as contas dos docentes e estudantes
export default function Portal() {
  const { pode, avisar } = useSessao()
  const [e, setE] = useState(null)
  const carregar = useCallback(() => api('/portal').then(setE).catch((x) => avisar(x.message, 'erro')), [avisar])
  useEffect(() => { carregar() }, [carregar])
  const enviar = (caminho, msg) => api(caminho, { metodo: 'POST' }).then((r) => { avisar(msg(r)); carregar() }).catch((x) => avisar(x.message, 'erro'))
  if (!e) return <Carregando />
  const c = e.contagem
  return (
    <>
      <Cabecalho titulo="Ligação ao Portal Académico" migalhas={[['Administração'], ['Portal']]}>
        {pode('administrar') && e.ativa && <>
          <button type="button" className="btn btn-theme" onClick={() => enviar('/portal/enviar', (r) => `Enviados: ${r.enviados}; com erro: ${r.erros}.`)}><i className="fa fa-paper-plane me-1" />Enviar agora</button>
          <button type="button" className="btn btn-outline-secondary" onClick={() => enviar('/portal/reenviar-todos', (r) => `${r.emFila} pessoa(s) postas na fila.`)}>Reenviar todos</button>
        </>}
      </Cabecalho>
      <div className="row">
        <div className="col-xl-5">
          <Painel titulo="Como funciona" icone="fa-info-circle">
            <p>Este sistema corre só na rede interna. Quando se regista ou altera um <strong>docente</strong> ou <strong>estudante</strong> com e-mail, envia ao portal, num só sentido e com assinatura, apenas: nome, e-mail, posto, ramo, NIP, telefone e unidade. O resto da ficha nunca sai daqui.</p>
            <p className="mb-0">Quem deixa de ser docente/estudante ou sai da Escola fica com a conta do portal desativada. Os envios repetem-se de minuto a minuto até o portal responder.</p>
          </Painel>
        </div>
        <div className="col-xl-7">
          <Painel titulo="Estado" icone="fa-exchange-alt">
            {!e.ativa ? <div className="alert alert-warning mb-0">A ligação está desligada. Para ligar, o administrador do servidor define <code>PORTAL_API_URL</code> e <code>INTEGRACAO_CHAVE</code> (a mesma chave na API do portal).</div> : <>
              <p>Portal: <code>{e.portal}</code></p>
              <div className="d-flex gap-3 mb-3">
                <span className="badge bg-success fs-6">{c.enviado ?? 0} enviadas</span>
                <span className="badge bg-warning text-dark fs-6">{c.pendente ?? 0} por enviar</span>
                <span className="badge bg-danger fs-6">{c.erro ?? 0} com erro</span>
              </div>
              {e.erros.length > 0 && <table className="table table-sm"><thead><tr><th>Pessoa</th><th>Erro</th><th>Tentativas</th><th>Última</th></tr></thead><tbody>{e.erros.map((x) => <tr key={x.pessoaId}><td><Link to={`/pessoas/${x.pessoaId}`}>{x.nome}</Link><div className="small text-muted">{x.email}</div></td><td className="small text-danger">{x.erro}</td><td>{x.tentativas}</td><td className="small">{dataHoraPt(x.quando)}</td></tr>)}</tbody></table>}
            </>}
          </Painel>
        </div>
      </div>
    </>
  )
}
