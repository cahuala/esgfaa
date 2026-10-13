import { useState } from 'react'
import { FaEye, FaEyeSlash } from 'react-icons/fa'
import Logo from '../../assets/Logo.png'
import Sede from '../../assets/Escola De Guerra.png'
import { useSessao } from '../sessaoContexto'

const SITE = import.meta.env.BASE_URL

function Entrar() {
  const { entrar } = useSessao()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [ver, setVer] = useState(false)
  const [erro, setErro] = useState('')
  const [aEntrar, setAEntrar] = useState(false)

  async function submeter(e) {
    e.preventDefault()
    setErro('')
    setAEntrar(true)
    try {
      await entrar(email.trim(), senha)
    } catch (falha) {
      setErro(falha.message)
      setAEntrar(false)
    }
  }

  return (
    <div className="p-entrada">
      <div className="p-entrada-imagem" style={{ backgroundImage: `url("${Sede}")` }}>
        <div>
          <span>Forças Armadas Angolanas</span>
          <h2>Escola Superior de Guerra</h2>
          <p>Cadeiras, materiais, trabalhos, notas e horários num só lugar.</p>
        </div>
      </div>
      <div className="p-entrada-formulario">
        <form onSubmit={submeter} noValidate>
          <img src={Logo} alt="" className="p-entrada-logo" />
          <h1>Portal Académico</h1>
          <p className="p-entrada-sub">Entre com o seu e-mail da Escola.</p>
          {erro && <p className="p-erro" role="alert">{erro}</p>}
          <div className="p-campo">
            <label htmlFor="email">E-mail</label>
            <input id="email" type="email" autoComplete="username" placeholder="nome@esgfaa.gov.ao" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="p-campo">
            <label htmlFor="senha">Palavra-passe</label>
            <div className="p-senha">
              <input id="senha" type={ver ? 'text' : 'password'} autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
              <button type="button" onClick={() => setVer(!ver)} aria-label={ver ? 'Esconder palavra-passe' : 'Mostrar palavra-passe'}>{ver ? <FaEyeSlash /> : <FaEye />}</button>
            </div>
          </div>
          <button type="submit" className="p-botao p-botao-largo" disabled={aEntrar || !email || !senha}>{aEntrar ? 'A entrar…' : 'Entrar'}</button>
          <p className="p-entrada-ajuda">
            Primeira vez? A palavra-passe inicial é o seu e-mail da Escola; vai ser-lhe pedido que a mude.
            Problemas no acesso: Secretaria Académica.
          </p>
          <a href={SITE} className="p-entrada-voltar">← Voltar ao site da Escola</a>
        </form>
      </div>
    </div>
  )
}

export default Entrar
