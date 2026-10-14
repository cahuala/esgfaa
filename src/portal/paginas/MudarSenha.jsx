import { useState } from 'react'
import { useSessao } from '../sessaoContexto'
import { Campo } from '../componentes'
import { primeiroNome } from '../formatar'
import MolduraEntrada from './MolduraEntrada'

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
      <button type="submit" className="btn btn-theme" disabled={aGuardar || !lista.every((r) => r.ok) || !f.atual}>{aGuardar ? 'A guardar…' : 'Guardar nova palavra-passe'}</button>
    </form>
  )

  if (!obrigatoria) return formulario

  return (
    <MolduraEntrada sobretitulo="Primeira entrada" titulo={`Bem-vindo(a), ${primeiroNome(conta.nome)}`} subtitulo="Escolha uma palavra-passe nova para continuar">
      <div className="alert alert-warning d-flex gap-2 py-2"><i className="fa fa-shield-alt mt-1" /><span>Por segurança, a palavra-passe inicial (o seu e-mail) deixa de funcionar.</span></div>
      {formulario}
      <button type="button" className="btn btn-link px-0 mt-2" onClick={sair}>Sair</button>
    </MolduraEntrada>
  )
}

export default MudarSenha
