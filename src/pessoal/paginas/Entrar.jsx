import { useState } from 'react'
import { useSessao } from '../sessao'
import Brasao from '../../assets/Logo.png'
import Sede from '../../assets/Escola De Guerra.png'

export default function Entrar() {
  const { entrar } = useSessao()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [aEntrar, setAEntrar] = useState(false)

  async function submeter(e) {
    e.preventDefault()
    setErro('')
    setAEntrar(true)
    try {
      await entrar(email, senha)
    } catch (f) {
      setErro(f.message)
      setAEntrar(false)
    }
  }

  return (
    <div id="app" className="app">
      <div className="login login-with-news-feed entrada-esg">
        <div className="news-feed">
          <div className="news-image" style={{ backgroundImage: `url("${Sede}")` }} />
          <div className="news-caption entrada-legenda">
            <span className="entrada-sobretitulo">Forças Armadas Angolanas</span>
            <h4 className="caption-title">Escola Superior de Guerra</h4>
            <p>Militares dos três ramos e pessoal civil ao serviço da Escola, com as carreiras segundo a Lei n.º 13/18.</p>
            <span className="entrada-bandeira" aria-hidden="true"><i /><i /><i /></span>
          </div>
        </div>
        <div className="login-container entrada-painel">
          <div className="entrada-cabecalho">
            <img src={Brasao} alt="Brasão da Escola Superior de Guerra" className="entrada-brasao" />
            <div>
              <span className="entrada-sobretitulo">Rede interna · Uso reservado</span>
              <h1>Gestão de Pessoal</h1>
              <p>Repartição de Pessoal e Quadros</p>
            </div>
          </div>
          <div className="login-content">
            <form onSubmit={submeter} className="fs-13px">
              {erro && <div className="alert alert-danger d-flex align-items-center py-2 mb-20px" role="alert"><i className="fa fa-exclamation-circle me-2" />{erro}</div>}
              <label className="entrada-rotulo" htmlFor="email">E-mail</label>
              <div className="entrada-campo mb-20px">
                <i className="fa fa-envelope" aria-hidden="true" />
                <input type="email" id="email" className="form-control" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <label className="entrada-rotulo" htmlFor="senha">Palavra-passe</label>
              <div className="entrada-campo mb-20px">
                <i className="fa fa-lock" aria-hidden="true" />
                <input type="password" id="senha" className="form-control" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
              </div>
              <button type="submit" className="btn btn-theme d-block w-100 h-45px btn-lg entrada-botao" disabled={aEntrar}>
                {aEntrar ? <><i className="fa fa-spinner fa-spin me-2" />A entrar…</> : <><i className="fa fa-sign-in-alt me-2" />Entrar</>}
              </button>
              <p className="text-muted small mt-3 mb-0"><i className="fa fa-shield-alt me-1" />Este sistema só funciona dentro da rede da Escola. Todas as consultas e alterações ficam registadas.</p>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
