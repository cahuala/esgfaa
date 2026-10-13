import { useState } from 'react'
import { FaShieldAlt } from 'react-icons/fa'
import { useSessao } from '../sessaoContexto'
import { Campo } from '../componentes'
import { primeiroNome } from '../formatar'

// regras iguais às da API (para avisar antes de enviar)
function regras(nova, conta) {
  return [
    { ok: nova.length >= 10, texto: 'Pelo menos 10 caracteres' },
    { ok: /[A-Za-zÀ-ÿ]/.test(nova) && /\d/.test(nova), texto: 'Letras e números' },
    { ok: Boolean(nova) && !nova.toLowerCase().includes(conta.email.split('@')[0].toLowerCase()), texto: 'Sem o seu e-mail' },
  ]
}

function MudarSenha({ obrigatoria = false, aoTerminar }) {
  const { conta, mudarSenha, sair } = useSessao()
  const [f, setF] = useState({ atual: '', nova: '', repetir: '' })
  const [erros, setErros] = useState({})
  const [aGuardar, setAGuardar] = useState(false)
  const lista = regras(f.nova, conta)

  async function submeter(e) {
    e.preventDefault()
    if (f.nova !== f.repetir) return setErros({ repetir: 'As duas palavras-passe não coincidem.' })
    setErros({})
    setAGuardar(true)
    try {
      await mudarSenha(f.atual, f.nova)
      setF({ atual: '', nova: '', repetir: '' })
      aoTerminar?.()
    } catch (falha) {
      setErros({ [falha.campo || 'nova']: falha.message })
    } finally {
      setAGuardar(false)
    }
  }

  const formulario = (
    <form onSubmit={submeter} className="p-formulario">
      <Campo id="atual" rotulo={obrigatoria ? 'Palavra-passe atual (o seu e-mail)' : 'Palavra-passe atual'} erro={erros.atual}>
        <input id="atual" type="password" autoComplete="current-password" value={f.atual} onChange={(e) => setF({ ...f, atual: e.target.value })} required />
      </Campo>
      <Campo id="nova" rotulo="Nova palavra-passe" erro={erros.nova}>
        <input id="nova" type="password" autoComplete="new-password" value={f.nova} onChange={(e) => setF({ ...f, nova: e.target.value })} required />
      </Campo>
      <ul className="p-regras">
        {lista.map((r) => <li key={r.texto} className={r.ok ? 'p-regra-ok' : ''}>{r.ok ? '✓' : '•'} {r.texto}</li>)}
      </ul>
      <Campo id="repetir" rotulo="Repetir a nova palavra-passe" erro={erros.repetir}>
        <input id="repetir" type="password" autoComplete="new-password" value={f.repetir} onChange={(e) => setF({ ...f, repetir: e.target.value })} required />
      </Campo>
      <button type="submit" className="p-botao" disabled={aGuardar || !lista.every((r) => r.ok) || !f.atual}>{aGuardar ? 'A guardar…' : 'Guardar nova palavra-passe'}</button>
    </form>
  )

  if (!obrigatoria) return formulario

  return (
    <div className="p-ecra-centro">
      <div className="p-cartao p-cartao-estreito">
        <div className="p-cartao-corpo">
          <span className="p-icone-grande"><FaShieldAlt aria-hidden="true" /></span>
          <h1 className="p-h1-pequeno">Bem-vindo(a), {primeiroNome(conta.nome)}</h1>
          <p className="p-texto-suave">Por segurança, escolha uma palavra-passe nova antes de continuar. A palavra-passe inicial (o seu e-mail) deixa de funcionar.</p>
          {formulario}
          <button type="button" className="p-ligacao-simples" onClick={sair}>Sair</button>
        </div>
      </div>
    </div>
  )
}

export default MudarSenha
