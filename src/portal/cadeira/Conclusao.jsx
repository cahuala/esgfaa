import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { BarraProgresso } from './Progresso'
import { t as tx } from '../../i18n/linguas'

// bloco da coluna direita: progresso do estudante e, com tudo concluído, o certificado da cadeira
function Conclusao({ c, progresso, avisar }) {
  const [r, setR] = useState(null)
  const [aEmitir, setAEmitir] = useState(false)
  useEffect(() => { api(`/cadeiras/${c.id}/conclusao`).then(setR).catch(() => {}) }, [c.id, progresso])

  async function emitir() {
    setAEmitir(true)
    try {
      const cert = await api(`/cadeiras/${c.id}/certificado`, { metodo: 'POST' })
      setR((x) => ({ ...x, certificado: cert }))
      avisar({ texto: tx('Certificado emitido.') })
    } catch (e) {
      avisar({ tipo: 'erro', texto: e.message })
    } finally {
      setAEmitir(false)
    }
  }

  return (
    <div className="panel panel-inverse">
      <div className="panel-heading"><h2 className="panel-title"><i className="fa fa-tasks me-2" />{tx('O meu progresso')}</h2></div>
      <div className="panel-body">
        <BarraProgresso p={progresso} />
        <div className="small text-muted mt-1">{progresso.feitas} {tx('de')} {progresso.total} {tx('atividades concluídas')}</div>
        {r?.certificado ? (
          <Link to={`/cadeiras/${c.id}/certificado`} className="btn btn-sm btn-success w-100 mt-3"><i className="fa fa-award me-1" />{tx('Ver o certificado')}</Link>
        ) : r?.concluida ? (
          <button type="button" className="btn btn-sm btn-theme w-100 mt-3" onClick={emitir} disabled={aEmitir}><i className="fa fa-award me-1" />{aEmitir ? tx('A emitir…') : tx('Cadeira concluída: obter certificado')}</button>
        ) : (
          <div className="small text-muted mt-2"><i className="fa fa-award me-1" />{tx('Conclua todas as atividades para obter o certificado da cadeira.')}</div>
        )}
      </div>
    </div>
  )
}

export default Conclusao
