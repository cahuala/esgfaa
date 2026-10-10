import { useState } from 'react'
import { api, guardarToken } from '../api'
import { useSessao } from '../sessaoContexto'
import { Aviso, CabecalhoPagina, Painel } from '../componentes/Ui'
import { dataHora } from '../formatar'

function Perfil() {
  const { utilizador, recarregar } = useSessao()
  const [form, setForm] = useState({ atual: '', nova: '', repetir: '' })
  const [aviso, setAviso] = useState(null)

  async function alterar(e) {
    e.preventDefault()
    if (form.nova !== form.repetir) {
      setAviso({ tipo: 'erro', texto: 'As duas palavras-passe novas não coincidem.' })
      return
    }
    try {
      // as outras sessões terminam; esta continua com o token novo
      const { token } = await api('/eu/senha', { metodo: 'PUT', corpo: { atual: form.atual, nova: form.nova } })
      guardarToken(token)
      await recarregar()
      setForm({ atual: '', nova: '', repetir: '' })
      setAviso({ texto: 'Palavra-passe alterada. As sessões abertas noutros computadores foram terminadas.' })
    } catch (falha) {
      setAviso({ tipo: 'erro', texto: falha.message })
    }
  }

  return (
    <>
      <CabecalhoPagina titulo="O meu perfil" migalhas={[{ rotulo: 'Perfil' }]} />
      <div className="row">
        <div className="col-lg-5">
          <Painel titulo="Conta">
            <dl className="row mb-0">
              <dt className="col-4">Nome</dt><dd className="col-8">{utilizador.nome}</dd>
              <dt className="col-4">E-mail</dt><dd className="col-8">{utilizador.email}</dd>
              <dt className="col-4">Papel</dt><dd className="col-8">{utilizador.nomePapel}</dd>
              <dt className="col-4">Criada em</dt><dd className="col-8 mb-0">{dataHora(utilizador.criadoEm)}</dd>
            </dl>
          </Painel>
        </div>
        <div className="col-lg-7">
          <Painel titulo="Alterar palavra-passe">
            <form onSubmit={alterar}>
              {[
                ['atual', 'Palavra-passe atual', 'current-password'],
                ['nova', 'Nova palavra-passe', 'new-password'],
                ['repetir', 'Repetir a nova palavra-passe', 'new-password'],
              ].map(([campo, rotulo, auto]) => (
                <div key={campo} className="mb-3">
                  <label className="form-label fw-bold" htmlFor={`p-${campo}`}>{rotulo}</label>
                  <input id={`p-${campo}`} type="password" className="form-control" autoComplete={auto} value={form[campo]} onChange={(e) => setForm({ ...form, [campo]: e.target.value })} required />
                </div>
              ))}
              <div className="form-text mb-3">Mínimo 10 caracteres, com letras e números. Não use o seu nome nem o e-mail.</div>
              <button type="submit" className="btn btn-theme"><i className="fa fa-key me-1" /> Alterar palavra-passe</button>
            </form>
          </Painel>
        </div>
      </div>
      <Aviso aviso={aviso} onFechar={() => setAviso(null)} />
    </>
  )
}

export default Perfil
