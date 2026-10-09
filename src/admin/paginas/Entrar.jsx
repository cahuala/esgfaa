import { useState } from 'react'
import { useSessao } from '../sessaoContexto'
import Brasao from '../../assets/Logo.png'
import { API_URL } from '../../conteudo/api'

// Página de entrada no estilo "login v1" do Color Admin
function Entrar() {
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
    } catch (falha) {
      setErro(falha.message)
      setAEntrar(false)
    }
  }

  return (
    <div id="app" className="app">
      <div className="login login-v1">
        <div className="login-container">
          <div className="login-header">
            <div className="brand">
              <div className="d-flex align-items-center">
                <img src={Brasao} alt="" className="admin-brasao-login" />
                <b className="me-1">ESGFAA</b> Painel
              </div>
              <small>Escola Superior de Guerra · Área reservada</small>
            </div>
            <div className="icon"><i className="fa fa-lock" /></div>
          </div>

          <div className="login-body">
            <div className="login-content fs-13px">
              <form onSubmit={submeter} data-bs-theme="dark">
                {!API_URL && (
                  <div className="alert alert-warning py-2 mb-20px" role="alert">
                    O endereço da API não está configurado (VITE_API_URL). O painel só funciona com a API ligada.
                  </div>
                )}
                {erro && <div className="alert alert-danger py-2 mb-20px" role="alert">{erro}</div>}
                <div className="form-floating mb-20px">
                  <input
                    type="email"
                    className="form-control fs-13px h-45px"
                    id="email"
                    placeholder="E-mail"
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <label htmlFor="email" className="d-flex align-items-center">E-mail</label>
                </div>
                <div className="form-floating mb-20px">
                  <input
                    type="password"
                    className="form-control fs-13px h-45px"
                    id="senha"
                    placeholder="Palavra-passe"
                    autoComplete="current-password"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    required
                  />
                  <label htmlFor="senha" className="d-flex align-items-center">Palavra-passe</label>
                </div>
                <div className="login-buttons">
                  <button type="submit" className="btn btn-theme h-45px d-block w-100 btn-lg" disabled={aEntrar}>
                    {aEntrar ? 'A entrar…' : 'Entrar'}
                  </button>
                </div>
                <p className="text-white-50 mt-20px mb-0 small">
                  Todas as entradas e ações neste painel ficam registadas.
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Entrar
