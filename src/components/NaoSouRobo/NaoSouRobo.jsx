import { useEffect, useRef, useState } from 'react'
import { obterProva } from '../../utils/provaRobo'
import { t as tx } from '../../i18n/linguas'
import './naoSouRobo.css'

/*
  Caixa «Não sou um robô» das páginas de entrada (painel, portal, pessoal). Ao marcar, o navegador resolve o
  desafio do servidor (menos de um segundo; mais para quem já errou a palavra-passe várias vezes) e entrega a
  prova a aoMudar. Cada prova só serve uma vez: depois de cada tentativa (renovar muda), resolve outra
  sozinha, sem pedir para marcar de novo. Sem a verificação no servidor, a caixa não aparece.
*/
export default function NaoSouRobo({ api, aoMudar, renovar = 0 }) {
  const [estado, setEstado] = useState('por_marcar') // por_marcar | a_verificar | feito | erro | desligado
  const [progresso, setProgresso] = useState(0)
  const [erro, setErro] = useState('')
  const marcado = useRef(false)

  async function verificar() {
    marcado.current = true
    setEstado('a_verificar')
    setErro('')
    setProgresso(0)
    aoMudar(null)
    try {
      const p = await obterProva(api, setProgresso)
      if (!p) { setEstado('desligado'); aoMudar(undefined); return }
      setEstado('feito')
      aoMudar(p)
    } catch (e) {
      setEstado('erro')
      setErro(e.message)
    }
  }

  // depois de cada tentativa a prova já foi usada: resolve outra (se a caixa já tinha sido marcada)
  useEffect(() => {
    if (renovar && marcado.current) verificar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renovar])

  if (estado === 'desligado') return null
  const aVerificar = estado === 'a_verificar'
  return (
    <div className={`nsr ${estado === 'feito' ? 'nsr-feito' : ''} ${estado === 'erro' ? 'nsr-erro' : ''}`}>
      <button type="button" role="checkbox" aria-checked={estado === 'feito'} aria-busy={aVerificar} className="nsr-caixa" disabled={aVerificar || estado === 'feito'} onClick={verificar} aria-label={tx('Não sou um robô')}>
        {aVerificar ? <span className="nsr-roda" aria-hidden="true" /> : estado === 'feito' ? <i className="fa fa-check" aria-hidden="true" /> : null}
      </button>
      <div className="nsr-texto">
        <b>{tx('Não sou um robô')}</b>
        <span aria-live="polite">{aVerificar ? tx('A verificar… {0} %', { 0: Math.round(progresso * 100) }) : estado === 'feito' ? tx('Verificado') : estado === 'erro' ? erro : tx('Marque para confirmar')}</span>
      </div>
      <i className="fa fa-shield-alt nsr-escudo" aria-hidden="true" title={tx('Verificação da própria Escola, sem serviços externos')} />
    </div>
  )
}
