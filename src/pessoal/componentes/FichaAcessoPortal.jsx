import { useState } from 'react'
import { api } from '../api'
import { imprimirFichas } from '../../admin/paginas/pessoal/fichasAcesso'
import { Modal } from './Ui'

/*
  Ficha de acesso ao Portal Académico, dada aqui mesmo (quem regista o estudante ou o docente entrega-lhe a
  ficha): o portal cria uma palavra-passe inicial nova, que só se vê nesta janela e se imprime em PDF.
  A palavra-passe anterior deixa de valer; na primeira entrada o portal obriga a mudá-la.
*/
export default function FichaAcessoPortal({ p, aoFechar }) {
  const [ficha, setFicha] = useState(null)
  const [aPedir, setAPedir] = useState(false)
  const [erro, setErro] = useState('')
  async function pedir() {
    setAPedir(true)
    setErro('')
    try {
      setFicha(await api(`/pessoas/${p.id}/ficha-acesso`, { metodo: 'POST' }))
    } catch (e) {
      setErro(e.message)
    } finally {
      setAPedir(false)
    }
  }
  const imprimir = () => imprimirFichas([ficha], ficha.portal ? { portal: `${ficha.portal}/` } : undefined)
  return (
    <Modal
      titulo="Ficha de acesso ao portal"
      aoFechar={aoFechar}
      rodape={ficha
        ? <><button type="button" className="btn btn-theme" onClick={imprimir}><i className="fa fa-print me-1" />Imprimir ficha (PDF)</button><button type="button" className="btn btn-white" onClick={aoFechar}>Fechar</button></>
        : <><button type="button" className="btn btn-theme" disabled={aPedir} onClick={pedir}><i className="fa fa-key me-1" />{aPedir ? 'A pedir ao portal…' : 'Gerar a ficha de acesso'}</button><button type="button" className="btn btn-white" onClick={aoFechar}>Cancelar</button></>}
    >
      {!ficha && (
        <>
          <p>O portal vai dar a <b>{p.nome}</b> uma palavra-passe inicial nova, para imprimir e entregar em mão.</p>
          <div className="alert alert-warning py-2 mb-0"><i className="fa fa-exclamation-triangle me-2" />A palavra-passe que tinha deixa de valer. Na primeira entrada, o portal pede-lhe que escolha outra.</div>
        </>
      )}
      {erro && <div className="alert alert-danger mt-3 mb-0">{erro}</div>}
      {ficha && (
        <dl className="row mb-0">
          <dt className="col-sm-4">Nome</dt><dd className="col-sm-8">{ficha.nome}</dd>
          <dt className="col-sm-4">Número</dt><dd className="col-sm-8">{ficha.numero}</dd>
          <dt className="col-sm-4">E-mail (entrada)</dt><dd className="col-sm-8">{ficha.email}</dd>
          <dt className="col-sm-4">Palavra-passe inicial</dt><dd className="col-sm-8 font-monospace fs-5">{ficha.senhaInicial}</dd>
          {ficha.portal && <><dt className="col-sm-4">Endereço</dt><dd className="col-sm-8">{ficha.portal}/</dd></>}
          <dd className="col-12 small text-muted mt-2 mb-0">Esta palavra-passe só se mostra agora: imprima a ficha antes de fechar.</dd>
        </dl>
      )}
    </Modal>
  )
}
