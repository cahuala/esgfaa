import { imprimirFichas } from './fichasAcesso'
import { t as tx } from '../../../i18n/linguas'

// a palavra-passe inicial só se vê aqui (uma vez): imprime-se a ficha para entregar em mão
export default function FichaAcesso({ c, fechar }) {
  return (
    <div className="modal d-block" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="ficha-titulo">
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h4 className="modal-title" id="ficha-titulo"><i className="fa fa-id-card me-2" />{tx('Ficha de acesso ao portal')}</h4>
          </div>
          <div className="modal-body">
            <dl className="row mb-2">
              <dt className="col-5">{tx('Nome')}</dt><dd className="col-7">{c.nome}</dd>
              <dt className="col-5">{tx('Número')}</dt><dd className="col-7 font-monospace">{c.numero}</dd>
              <dt className="col-5">{tx('E-mail (entrada)')}</dt><dd className="col-7">{c.email}</dd>
              <dt className="col-5">{tx('Palavra-passe inicial')}</dt><dd className="col-7 font-monospace fs-5 fw-bold">{c.senhaInicial}</dd>
            </dl>
            <div className="alert alert-warning py-2 small mb-0"><i className="fa fa-exclamation-triangle me-1" />{tx('Esta palavra-passe não volta a ser mostrada. Imprima a ficha e entregue-a em mão; se se perder, use «Repor a palavra-passe».')}</div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-white" onClick={fechar}>{tx('Fechar')}</button>
            <button type="button" className="btn btn-theme" onClick={() => imprimirFichas([c])}><i className="fa fa-print me-1" />{tx('Imprimir ficha (PDF)')}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

