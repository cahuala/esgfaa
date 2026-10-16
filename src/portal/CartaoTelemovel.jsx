import { useEffect, useState } from 'react'
import { aoMudarInstalacao, avisosPossiveis, eIphone, estadoAvisos, instalado, instalar, ligarAvisos, podeInstalar } from './telemovel'
import { t as tx } from '../i18n/linguas'

const FECHADO = 'esg_telemovel_fechado'
const lerFechado = () => { try { return localStorage.getItem(FECHADO) === '1' } catch { return false } }

/*
  Um só cartão, com dois botões: "Instalar" (o portal fica como uma aplicação no telemóvel)
  e "Receber avisos". Desaparece quando já está tudo feito ou com "Agora não".
*/
function CartaoTelemovel() {
  const [fechado, setFechado] = useState(lerFechado)
  const [avisos, setAvisos] = useState(null)
  const [, atualizar] = useState(0)
  const [aLigar, setALigar] = useState(false)
  const [erro, setErro] = useState('')
  useEffect(() => { estadoAvisos().then(setAvisos).catch(() => setAvisos('indisponivel')) }, [])
  useEffect(() => aoMudarInstalacao(() => atualizar((n) => n + 1)), [])

  const jaInstalado = instalado()
  const iphoneSemInstalar = eIphone() && !jaInstalado
  const mostrarInstalar = !jaInstalado && podeInstalar()
  const mostrarAvisos = avisosPossiveis() && avisos === 'desligado'
  if (fechado || avisos === null) return null
  if (!mostrarInstalar && !mostrarAvisos && !iphoneSemInstalar && !erro) return null

  function fechar() {
    try { localStorage.setItem(FECHADO, '1') } catch { /* sem armazenamento */ }
    setFechado(true)
  }
  async function receber() {
    setALigar(true)
    setErro('')
    try {
      const r = await ligarAvisos()
      setAvisos(r)
      if (r === 'bloqueado') setErro(tx('Os avisos ficaram bloqueados. Pode permiti-los nas definições do navegador e ligá-los no seu perfil.'))
    } catch {
      setErro(tx('Este navegador não deixou ligar os avisos (por exemplo, numa janela privada). Experimente no navegador habitual.'))
    } finally {
      setALigar(false)
    }
  }

  return (
    <div className="p-telemovel" role="region" aria-label={tx('Portal no telemóvel')}>
      <span className="p-telemovel-icone" aria-hidden="true"><i className="fa fa-mobile-alt" /></span>
      <div className="flex-grow-1 min-w-0">
        <div className="fw-bold">{tx('Use o portal no telemóvel')}</div>
        <div className="small text-muted">
          {iphoneSemInstalar
            ? <>{tx('No iPhone: toque em')} <i className="fa fa-share-square" aria-label={tx('Partilhar')} /> {tx('e depois em «Adicionar ao ecrã principal». Depois, abra o portal pelo ícone para receber os avisos.')}</>
            : tx('Fica com um ícone no ecrã e recebe os avisos de notas, prazos e mensagens, mesmo com o portal fechado.')}
        </div>
        {erro && <div className="small text-danger mt-1" role="alert">{erro}</div>}
      </div>
      <div className="d-flex gap-2 flex-wrap">
        {mostrarInstalar && <button type="button" className="btn btn-sm btn-theme" onClick={instalar}><i className="fa fa-download me-1" />{tx('Instalar')}</button>}
        {mostrarAvisos && <button type="button" className="btn btn-sm btn-theme" onClick={receber} disabled={aLigar}><i className="fa fa-bell me-1" />{aLigar ? tx('A ligar…') : tx('Receber avisos')}</button>}
        <button type="button" className="btn btn-sm btn-white" onClick={fechar}>{tx('Agora não')}</button>
      </div>
    </div>
  )
}

export default CartaoTelemovel
