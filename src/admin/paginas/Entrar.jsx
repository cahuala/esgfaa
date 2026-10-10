import { useState } from 'react'
import { useSessao } from '../sessaoContexto'
import Brasao from '../../assets/Logo.png'
import Sede from '../../assets/Escola De Guerra.png'
import { API_URL } from '../../conteudo/api'

// Página de entrada: base "login with news feed" do Color Admin, com a identidade da Escola
function Entrar() {
  const { entrar } = useSessao()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [verSenha, setVerSenha] = useState(false)
  const [erro, setErro] = useState('')
  const [aEntrar, setAEntrar] = useState(false)

  async function submeter(e) {
    e.preventDefault()
    setErro('')
    setAEntrar(true)
    try {
      await entrar(email, senha)
    } catch (falha) {
      setErro(falha.message)
      setAEntrar(false)
    }
  }

  return (
    <div id="app" className="app">
      <div className="login login-with-news-feed entrada-esg">
        {/* Fotografia da sede */}
        <div className="news-feed">
          <div className="news-image" style={{ backgroundImage: `url("${Sede}")` }} />
          <div className="news-caption entrada-legenda">
            <span className="entrada-sobretitulo">Forças Armadas Angolanas</span>
            <h4 className="caption-title">Escola Superior de Guerra</h4>
            <p>Formar quem comanda. Servir Angola com competência, disciplina e integridade.</p>
            <span className="entrada-bandeira" aria-hidden="true"><i /><i /><i /></span>
          </div>
        </div>

        {/* Formulário */}
        <div className="login-container entrada-painel">
          <div className="entrada-cabecalho">
            <img src={Brasao} alt="Brasão da Escola Superior de Guerra" className="entrada-brasao" />
            <div>
              <span className="entrada-sobretitulo">Área reservada</span>
              <h1>Painel de gestão</h1>
              <p>Escola Superior de Guerra · FAA</p>
            </div>
          </div>

          <div className="login-content">
            <form onSubmit={submeter} className="fs-13px">
              {!API_URL && (
                <div className="alert alert-warning py-2 mb-20px" role="alert">
                  O servidor do painel ainda não está ligado a este endereço. Contacte o administrador do sistema.
                </div>
              )}
              {erro && (
                <div className="alert alert-danger d-flex align-items-center py-2 mb-20px" role="alert">
                  <i className="fa fa-exclamation-circle me-2" />{erro}
                </div>
              )}

              <label className="entrada-rotulo" htmlFor="email">E-mail institucional</label>
              <div className="entrada-campo mb-20px">
                <i className="fa fa-envelope" aria-hidden="true" />
                <input
                  type="email"
                  id="email"
                  className="form-control"
                  placeholder="nome@esgfaa.gov.ao"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <label className="entrada-rotulo" htmlFor="senha">Palavra-passe</label>
              <div className="entrada-campo mb-30px">
                <i className="fa fa-lock" aria-hidden="true" />
                <input
                  type={verSenha ? 'text' : 'password'}
                  id="senha"
                  className="form-control"
                  autoComplete="current-password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                />
                <button type="button" className="entrada-ver" onClick={() => setVerSenha(!verSenha)} aria-label={verSenha ? 'Esconder palavra-passe' : 'Mostrar palavra-passe'}>
                  <i className={`fa ${verSenha ? 'fa-eye-slash' : 'fa-eye'}`} />
                </button>
              </div>

              <button type="submit" className="btn btn-theme d-block h-45px w-100 btn-lg fs-14px" disabled={aEntrar}>
                {aEntrar ? <><span className="spinner-border spinner-border-sm me-2" />A verificar…</> : <>Entrar <i className="fa fa-arrow-right ms-2" /></>}
              </button>

              <div className="entrada-aviso">
                <i className="fa fa-shield-alt" aria-hidden="true" />
                <span>Acesso exclusivo a pessoal autorizado. Todas as entradas e ações ficam registadas, com data e endereço IP.</span>
              </div>

              <a href={import.meta.env.BASE_URL} className="entrada-voltar"><i className="fa fa-arrow-left me-2" />Voltar ao site</a>
            </form>
          </div>

          <p className="entrada-rodape">© {new Date().getFullYear()} Escola Superior de Guerra das Forças Armadas Angolanas</p>
        </div>
      </div>
    </div>
  )
}

export default Entrar
