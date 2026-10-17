import { useState } from 'react'
import { api } from '../api'
import { Cartao } from '../componentes'
import { t as tx } from '../../i18n/linguas'

/*
  Ferramenta externa (LTI 1.3): o portal começa o login na ferramenta com um formulário enviado numa janela
  nova (muitas ferramentas não funcionam dentro de molduras de outros sites). O estudante entra já identificado.
*/
function Lti({ m, falhou }) {
  const [aAbrir, setAAbrir] = useState(false)
  async function abrir() {
    setAAbrir(true)
    try {
      const { url, campos } = await api(`/materiais/${m.id}/lti`, { metodo: 'POST' })
      const form = document.createElement('form')
      Object.assign(form, { method: 'POST', action: url, target: '_blank' })
      for (const [k, v] of Object.entries(campos)) {
        const i = document.createElement('input')
        Object.assign(i, { type: 'hidden', name: k, value: v })
        form.appendChild(i)
      }
      document.body.appendChild(form)
      form.submit()
      form.remove()
    } catch (e) {
      falhou(e)
    } finally {
      setAAbrir(false)
    }
  }
  return (
    <Cartao titulo={<><i className="fa fa-plug me-2" />{m.titulo}</>}>
      {m.descricao && <p className="text-muted">{m.descricao}</p>}
      <div className="d-flex align-items-center gap-3 flex-wrap p-3 rounded bg-light">
        <span className="p-atividade-icone bg-gray-600"><i className="fa fa-plug" /></span>
        <div className="flex-grow-1 small">
          <b className="d-block">{m.estrutura?.nome || tx('Ferramenta externa')}</b>
          <span className="text-muted">{tx('Abre numa janela nova. Entra com a sua conta do portal, sem outra palavra-passe.')}</span>
        </div>
        <button type="button" className="btn btn-theme" onClick={abrir} disabled={aAbrir}><i className="fa fa-external-link-alt me-1" />{aAbrir ? tx('A abrir…') : tx('Abrir a ferramenta')}</button>
      </div>
    </Cartao>
  )
}

export default Lti
