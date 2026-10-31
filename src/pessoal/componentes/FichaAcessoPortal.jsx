import { useState } from 'react'
import { api } from '../api'
import { imprimirFichas } from '../../admin/paginas/pessoal/fichasAcesso'
import { Modal } from './Ui'
import Logo from '../../assets/Logo.png'

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
        <div className="pes-ficha-acesso">
          <div className="pes-ficha-acesso-topo">
            <img src={Logo} alt="" />
            <div><strong>ESCOLA SUPERIOR DE GUERRA</strong><span>Portal Académico · Ficha de acesso</span></div>
          </div>
          <div className="pes-ficha-acesso-risca" />
          <div className="pes-ficha-acesso-corpo">
            <dl>
              <dt>Nome</dt><dd>{ficha.nome}</dd>
              <dt>Número</dt><dd>{ficha.numero}</dd>
              <dt>E-mail (para entrar)</dt><dd>{ficha.email}</dd>
              {ficha.portal && <><dt>Endereço</dt><dd className="pes-ficha-acesso-url">{ficha.portal}/</dd></>}
            </dl>
            <div className="pes-ficha-acesso-senha">
              <span>Palavra-passe inicial</span>
              <code>{ficha.senhaInicial}</code>
              <small>Muda-se na primeira entrada</small>
            </div>
          </div>
          <div className="pes-ficha-acesso-aviso"><i className="fa fa-exclamation-circle me-1" />Esta palavra-passe só se mostra agora: imprima a ficha antes de fechar.</div>
        </div>
      )}
    </Modal>
  )
}
