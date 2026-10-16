import { useEffect, useState } from 'react'
import { desligarAvisos, eIphone, estadoAvisos, instalado, ligarAvisos } from './telemovel'
import { t as tx } from '../i18n/linguas'

// no perfil: ligar ou desligar os avisos neste aparelho (telemóvel ou computador)
function AvisosAparelho() {
  const [estado, setEstado] = useState(null)
  const [aMudar, setAMudar] = useState(false)
  useEffect(() => { estadoAvisos().then(setEstado).catch(() => setEstado('indisponivel')) }, [])
  async function mudar(ligar) {
    setAMudar(true)
    try { setEstado(ligar ? await ligarAvisos() : await desligarAvisos()) } catch { setEstado('indisponivel') } finally { setAMudar(false) }
  }
  if (estado === null) return null
  return (
    <div className="mt-3 pt-3 border-top">
      <div className="form-check form-switch">
        <input id="pref-push" className="form-check-input" type="checkbox" checked={estado === 'ligado'} disabled={aMudar || estado === 'indisponivel' || estado === 'bloqueado'} onChange={(e) => mudar(e.target.checked)} />
        <label className="form-check-label" htmlFor="pref-push">{tx('Receber os avisos neste aparelho')}</label>
      </div>
      <p className="small text-muted mt-1 mb-0">
        {estado === 'bloqueado' && tx('Os avisos estão bloqueados neste navegador. Para os receber, permita as notificações deste site nas definições do navegador.')}
        {estado === 'indisponivel' && (eIphone() && !instalado()
          ? tx('No iPhone, primeiro adicione o portal ao ecrã principal (Partilhar → «Adicionar ao ecrã principal») e abra-o pelo ícone.')
          : tx('Este navegador não recebe avisos do portal.'))}
        {(estado === 'ligado' || estado === 'desligado') && tx('Aparecem no telemóvel ou no computador mesmo com o portal fechado. Cada aparelho liga-se à parte.')}
      </p>
    </div>
  )
}

export default AvisosAparelho
