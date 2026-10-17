import { useEffect, useState } from 'react'
import { t as tx } from '../i18n/linguas'

const POLITICA = `${import.meta.env.BASE_URL}Privacidade`

/*
  Aviso de privacidade na primeira entrada (Lei n.º 22/11): diz que dados se tratam e para quê, e liga à
  política completa. Fica registado quando a pessoa toma conhecimento; depois não volta a aparecer.
  obter() → { conhecimentoEm }, aceitar() → promessa.
*/
export default function AvisoPrivacidade({ obter, aceitar, area, ligacao = POLITICA }) {
  const [mostrar, setMostrar] = useState(false)
  const [aGuardar, setAGuardar] = useState(false)
  useEffect(() => {
    let vivo = true
    obter().then((r) => { if (vivo && !r.conhecimentoEm) setMostrar(true) }).catch(() => {})
    return () => { vivo = false }
  }, [obter])
  if (!mostrar) return null
  const confirmar = async () => {
    setAGuardar(true)
    try { await aceitar(); setMostrar(false) } catch { setAGuardar(false) }
  }
  return (
    <>
      <div className="modal d-block" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="privacidade-titulo">
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div className="modal-content">
            <div className="modal-header"><h4 className="modal-title" id="privacidade-titulo"><i className="fa fa-user-shield me-2" />{tx('Protecção dos seus dados pessoais')}</h4></div>
            <div className="modal-body">
              <p>{tx('A Escola Superior de Guerra trata os seus dados pessoais de acordo com a Lei n.º 22/11, de 17 de Junho (Lei da Protecção de Dados Pessoais).')}</p>
              <ul className="mb-3">
                <li>{area === 'painel' ? tx('Neste painel, cada utilizador só acede ao que precisa para as suas funções; todas as consultas e alterações ficam registadas.') : tx('No portal tratamos os dados da sua conta, matrículas, notas, trabalhos, presenças e mensagens, só para a gestão académica.')}</li>
                <li>{tx('Os dados não são vendidos nem cedidos a terceiros e ficam nos servidores da Escola.')}</li>
                <li>{tx('Tem direito a aceder aos seus dados, a pedir a sua correcção e a opor-se a um tratamento.')}{area !== 'painel' && <> {tx('No portal, em «Perfil → Os meus dados».')}</>}</li>
              </ul>
              <a href={ligacao} target="_blank" rel="noreferrer"><i className="fa fa-external-link-alt me-1" />{tx('Ler a política de privacidade completa')}</a>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-theme" onClick={confirmar} disabled={aGuardar}><i className="fa fa-check me-1" />{tx('Tomei conhecimento')}</button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  )
}
