import { useState } from 'react'
import { api } from '../api'
import { useSessao } from '../sessao'
import { Cabecalho, Painel } from '../componentes/Ui'
import DoisFatores from '../componentes/DoisFatores'

export default function MudarSenha({ obrigatoria = false }) {
  const { mudouSenha, avisar, sair } = useSessao()
  const [d, setD] = useState({ atual: '', nova: '', repetir: '' })
  const [erro, setErro] = useState('')
  const [aGuardar, setAGuardar] = useState(false)
  async function guardar(e) {
    e.preventDefault()
    setErro('')
    if (d.nova !== d.repetir) return setErro('As duas palavras-passe novas não são iguais.')
    setAGuardar(true)
    try {
      await api('/mudar-senha', { metodo: 'POST', corpo: { atual: d.atual, nova: d.nova } })
      await mudouSenha()
      avisar('Palavra-passe alterada.')
      setD({ atual: '', nova: '', repetir: '' })
    } catch (f) {
      setErro(f.message)
    } finally {
      setAGuardar(false)
    }
  }
  const campo = (k, rotulo, auto) => (
    <div className="mb-3">
      <label className="form-label" htmlFor={k}>{rotulo}</label>
      <input id={k} type="password" className="form-control" autoComplete={auto} value={d[k]} onChange={(e) => setD({ ...d, [k]: e.target.value })} required />
    </div>
  )
  const form = (
    <form onSubmit={guardar} style={{ maxWidth: 420 }}>
      {obrigatoria && <div className="alert alert-info">Antes de continuar, escolha uma palavra-passe só sua (pelo menos 10 caracteres, com letras e números).</div>}
      {erro && <div className="alert alert-danger">{erro}</div>}
      {campo('atual', 'Palavra-passe atual', 'current-password')}
      {campo('nova', 'Nova palavra-passe', 'new-password')}
      {campo('repetir', 'Repetir a nova palavra-passe', 'new-password')}
      <button type="submit" className="btn btn-theme" disabled={aGuardar}><i className="fa fa-key me-2" />Mudar palavra-passe</button>
      {obrigatoria && <button type="button" className="btn btn-link" onClick={sair}>Sair</button>}
    </form>
  )
  if (obrigatoria) return <div className="container py-5"><Painel titulo="Mudar a palavra-passe" icone="fa-key">{form}</Painel></div>
  return <><Cabecalho titulo="Segurança da conta" subtitulo="palavra-passe e verificação em dois passos" migalhas={[['Segurança da conta']]} /><div className="row"><div className="col-xl-5"><Painel titulo="Mudar a palavra-passe" icone="fa-key">{form}</Painel></div><div className="col-xl-7"><DoisFatores /></div></div></>
}
