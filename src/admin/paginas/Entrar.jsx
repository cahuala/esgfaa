import { useState } from 'react'
import { useSessao } from '../sessaoContexto'
import Brasao from '../../assets/Logo-ecra.webp'
import Sede from '../../assets/Escola De Guerra-ecra.webp'
import { API_URL } from '../../conteudo/api'
import { t as tx } from '../../i18n/linguas'
import LinguasEntrada from '../../i18n/LinguasEntrada'
import NaoSouRobo from '../../components/NaoSouRobo/NaoSouRobo'
import { api } from '../api'

// Página de entrada: base "login with news feed" do Color Admin, com a identidade da Escola
function Entrar() {
  const { entrar } = useSessao()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [verSenha, setVerSenha] = useState(false)
  const [erro, setErro] = useState('')
  const [aEntrar, setAEntrar] = useState(false)
  // verificação em dois passos: a palavra-passe está certa, falta o código do telemóvel
  const [pedeCodigo, setPedeCodigo] = useState(false)
  const [codigo, setCodigo] = useState('')
  // «Não sou um robô»: null = por verificar; undefined = o servidor não pede; objecto = a prova
  const [prova, setProva] = useState(null)
  const [tentativas, setTentativas] = useState(0)

  async function submeter(e) {
    e.preventDefault()
    setErro('')
    setAEntrar(true)
    try {
      await entrar(email, senha, pedeCodigo ? codigo : undefined, prova)
    } catch (falha) {
      // a prova só serve uma vez: a caixa resolve outra sozinha
      setTentativas((n) => n + 1)
      if (falha.codigo === 'codigo_2fa') {
        if (pedeCodigo) setErro(falha.message)
        setPedeCodigo(true)
        setCodigo('')
      } else setErro(falha.message)
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
            <span className="entrada-sobretitulo">{tx('Forças Armadas Angolanas')}</span>
            <h4 className="caption-title">{tx('Escola Superior de Guerra')}</h4>
            <p>{tx('Formar quem comanda. Servir Angola com competência, disciplina e integridade.')}</p>
            <span className="entrada-bandeira" aria-hidden="true"><i /><i /><i /></span>
          </div>
        </div>

        {/* Formulário */}
        <div className="login-container entrada-painel">
          <LinguasEntrada />
          <div className="entrada-cabecalho">
            <img src={Brasao} alt={tx('Brasão da Escola Superior de Guerra')} className="entrada-brasao" />
            <div>
              <span className="entrada-sobretitulo">{tx('Área reservada')}</span>
              <h1>{tx('Painel de gestão')}</h1>
              <p>{tx('Escola Superior de Guerra · FAA')}</p>
            </div>
          </div>

          <div className="login-content">
            <form onSubmit={submeter} className="fs-13px">
              {!API_URL && (
                <div className="alert alert-warning py-2 mb-20px" role="alert">
                  {tx('O servidor do painel ainda não está ligado a este endereço. Contacte o administrador do sistema.')}
                </div>
              )}
              {erro && (
                <div className="alert alert-danger d-flex align-items-center py-2 mb-20px" role="alert">
                  <i className="fa fa-exclamation-circle me-2" />{erro}
                </div>
              )}

              <label className="entrada-rotulo" htmlFor="email">{tx('E-mail institucional')}</label>
              <div className="entrada-campo mb-20px">
                <i className="fa fa-envelope" aria-hidden="true" />
                <input
                  type="email"
                  id="email"
                  className="form-control"
                  placeholder={tx('nome@esgfaa.gov.ao')}
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <label className="entrada-rotulo" htmlFor="senha">{tx('Palavra-passe')}</label>
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
                <button type="button" className="entrada-ver" onClick={() => setVerSenha(!verSenha)} aria-label={verSenha ? tx('Esconder palavra-passe') : tx('Mostrar palavra-passe')}>
                  <i className={`fa ${verSenha ? 'fa-eye-slash' : 'fa-eye'}`} />
                </button>
              </div>

              {pedeCodigo && (
                <>
                  <label className="entrada-rotulo" htmlFor="codigo">{tx('Código da aplicação de autenticação')}</label>
                  <div className="entrada-campo mb-2">
                    <i className="fa fa-mobile-alt" aria-hidden="true" />
                    <input id="codigo" className="form-control" inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={11} value={codigo} onChange={(e) => setCodigo(e.target.value.trim())} required />
                  </div>
                  <p className="small text-muted mb-30px">{tx('Os 6 algarismos que a aplicação mostra agora. Perdeu o telemóvel? Use um código de recuperação.')}</p>
                </>
              )}

              <NaoSouRobo api={api} aoMudar={setProva} renovar={tentativas} />

              <button type="submit" className="btn btn-theme d-block h-45px w-100 btn-lg fs-14px" disabled={aEntrar || prova === null}>
                {aEntrar ? <><span className="spinner-border spinner-border-sm me-2" />{tx('A verificar…')}</> : <>{tx('Entrar')} <i className="fa fa-arrow-right ms-2" /></>}
              </button>

              <div className="entrada-aviso">
                <i className="fa fa-shield-alt" aria-hidden="true" />
                <span>{tx('Acesso exclusivo a pessoal autorizado. Todas as entradas e ações ficam registadas, com data e endereço IP.')}</span>
              </div>

              <a href={import.meta.env.BASE_URL} className="entrada-voltar"><i className="fa fa-arrow-left me-2" />{tx('Voltar ao site')}</a>
            </form>
          </div>

          <p className="entrada-rodape">© {new Date().getFullYear()} {tx('Escola Superior de Guerra das Forças Armadas Angolanas')}</p>
        </div>
      </div>
    </div>
  )
}

export default Entrar
