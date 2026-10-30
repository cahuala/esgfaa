import { useState } from 'react'
import { useSessao } from '../sessaoContexto'
import MolduraEntrada from './MolduraEntrada'
import { t as tx } from '../../i18n/linguas'
import NaoSouRobo from '../../components/NaoSouRobo/NaoSouRobo'
import { api } from '../api'

const SITE = import.meta.env.BASE_URL

function Entrar() {
  const { entrar } = useSessao()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [ver, setVer] = useState(false)
  const [erro, setErro] = useState('')
  const [aEntrar, setAEntrar] = useState(false)
  // «Não sou um robô»: null = por verificar; undefined = o servidor não pede; objecto = a prova
  const [prova, setProva] = useState(null)
  const [tentativas, setTentativas] = useState(0)

  async function submeter(e) {
    e.preventDefault()
    setErro('')
    setAEntrar(true)
    try {
      await entrar(email.trim(), senha, prova)
    } catch (falha) {
      setTentativas((n) => n + 1)
      setErro(falha.message)
      setAEntrar(false)
    }
  }

  return (
    <MolduraEntrada sobretitulo={tx('Estudantes e docentes')} titulo={tx('Portal Académico')} subtitulo={tx('Entre com o seu e-mail da Escola')}>
      <form onSubmit={submeter} className="fs-13px" noValidate>
        {erro && <div className="alert alert-danger d-flex align-items-center py-2 mb-20px" role="alert"><i className="fa fa-exclamation-circle me-2" />{erro}</div>}

        <label className="entrada-rotulo" htmlFor="email">{tx('E-mail')}</label>
        <div className="entrada-campo mb-20px">
          <i className="fa fa-envelope" aria-hidden="true" />
          <input id="email" type="email" className="form-control" autoComplete="username" placeholder={tx('nome@esgfaa.gov.ao')} value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>

        <label className="entrada-rotulo" htmlFor="senha">{tx('Palavra-passe')}</label>
        <div className="entrada-campo mb-30px">
          <i className="fa fa-lock" aria-hidden="true" />
          <input id="senha" type={ver ? 'text' : 'password'} className="form-control" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
          <button type="button" className="entrada-ver" onClick={() => setVer(!ver)} aria-label={ver ? tx('Esconder palavra-passe') : tx('Mostrar palavra-passe')}>
            <i className={`fa ${ver ? 'fa-eye-slash' : 'fa-eye'}`} />
          </button>
        </div>

        <NaoSouRobo api={api} aoMudar={setProva} renovar={tentativas} />

        <button type="submit" className="btn btn-theme d-block h-45px w-100 btn-lg fs-14px" disabled={aEntrar || !email || !senha || prova === null}>
          {aEntrar ? <><span className="spinner-border spinner-border-sm me-2" />{tx('A entrar…')}</> : <>{tx('Entrar')} <i className="fa fa-arrow-right ms-2" /></>}
        </button>

        <div className="entrada-aviso">
          <i className="fa fa-info-circle" aria-hidden="true" />
          <span>{tx('Primeira vez? Use a palavra-passe da ficha de acesso entregue pela Repartição de Pessoal e Quadros; vai ser-lhe pedido que a mude.')}</span>
        </div>
        <a href={SITE} className="entrada-voltar"><i className="fa fa-arrow-left me-2" />{tx('Voltar ao site da Escola')}</a>
      </form>
    </MolduraEntrada>
  )
}

export default Entrar
