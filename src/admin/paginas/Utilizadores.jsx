import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useSessao } from '../sessaoContexto'
import { Aviso, CabecalhoPagina, Carregando, Confirmar, Erro, Painel } from '../componentes/Ui'
import { dataHora } from '../formatar'
import { t as tx } from '../../i18n/linguas'

const VAZIO = { nome: '', email: '', papel: 'redator', senha: '' }
const CORES_PAPEIS = { administrador: 'bg-danger', editor_chefe: 'bg-primary', redator: 'bg-teal', moderador: 'bg-warning text-dark', analista: 'bg-indigo' }

// palavra-passe aleatória e forte para novos utilizadores
function gerarSenha() {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz'
  const numeros = '23456789'
  const valores = crypto.getRandomValues(new Uint32Array(14))
  const s = Array.from(valores, (v, i) => (i % 4 === 3 ? numeros[v % numeros.length] : letras[v % letras.length]))
  return s.join('')
}

function Utilizadores() {
  const { utilizador: eu, pode } = useSessao()
  const [lista, setLista] = useState(null)
  const [papeis, setPapeis] = useState([])
  const [erro, setErro] = useState('')
  const [form, setForm] = useState(null) // { ...dados, id? }
  const [aGuardar, setAGuardar] = useState(false)
  const [erroForm, setErroForm] = useState('')
  const [confirmar, setConfirmar] = useState(null)
  const [aviso, setAviso] = useState(null)

  const carregar = useCallback(() => {
    api('/utilizadores').then((r) => { setErro(''); setLista(r) }).catch((e) => setErro(e.message))
  }, [])
  useEffect(carregar, [carregar])
  useEffect(() => { api('/papeis').then((r) => setPapeis(r.papeis)).catch(() => {}) }, [])

  const papel = (id) => papeis.find((p) => p.id === id)
  // só quem gere papéis pode dar o papel de Administrador
  const papeisAtribuiveis = papeis.filter((p) => p.id !== 'administrador' || pode('papeis.gerir'))

  async function guardar(e) {
    e.preventDefault()
    setErroForm('')
    setAGuardar(true)
    try {
      const corpo = { nome: form.nome, email: form.email, papel: form.papel }
      if (form.senha) corpo.senha = form.senha
      if (form.id) await api(`/utilizadores/${form.id}`, { metodo: 'PUT', corpo })
      else await api('/utilizadores', { metodo: 'POST', corpo })
      setAviso({ texto: form.id ? tx('Utilizador atualizado.') : tx('Utilizador criado. Comunique a palavra-passe a {0} por um canal seguro.', { 0: form.nome }) })
      setForm(null)
      carregar()
    } catch (falha) {
      setErroForm(falha.message)
    } finally {
      setAGuardar(false)
    }
  }

  // quem perdeu o telemóvel e os códigos de recuperação: volta a ligar a verificação ao entrar
  function reporDoisFatores(u) {
    setConfirmar({
      titulo: tx('Repor a verificação em dois passos'),
      texto: <><b>{u.nome}</b> {tx('passa a entrar só com a palavra-passe e terá de ligar de novo a verificação em dois passos. Confirme a identidade da pessoa antes de o fazer.')}</>,
      botao: tx('Repor'),
      perigo: true,
      confirmar: async () => {
        setConfirmar(null)
        try {
          await api(`/utilizadores/${u.id}/2fa/repor`, { metodo: 'POST' })
          setAviso({ texto: tx('Verificação em dois passos reposta.') })
        } catch (e) {
          setAviso({ tipo: 'erro', texto: e.message })
        }
      },
    })
  }

  function alternarAtivo(u) {
    setConfirmar({
      titulo: u.ativo ? tx('Desativar utilizador') : tx('Reativar utilizador'),
      texto: u.ativo
        ? <><b>{u.nome}</b> {tx('deixa de conseguir entrar no painel. O histórico das suas ações mantém-se.')}</>
        : <><b>{u.nome}</b> {tx('volta a poder entrar no painel.')}</>,
      botao: u.ativo ? tx('Desativar') : tx('Reativar'),
      perigo: u.ativo,
      confirmar: async () => {
        setConfirmar(null)
        try {
          await api(`/utilizadores/${u.id}`, { metodo: 'PUT', corpo: { ativo: !u.ativo } })
          setAviso({ texto: u.ativo ? tx('Utilizador desativado.') : tx('Utilizador reativado.') })
          carregar()
        } catch (e) {
          setAviso({ tipo: 'erro', texto: e.message })
        }
      },
    })
  }

  return (
    <>
      <CabecalhoPagina titulo={tx('Utilizadores')} subtitulo={tx('quem pode entrar no painel')} migalhas={[{ rotulo: tx('Utilizadores') }]}>
        {pode('utilizadores.criar') && (
          <button className="btn btn-theme" onClick={() => { setErroForm(''); setForm({ ...VAZIO, senha: gerarSenha() }) }}>
            <i className="fa fa-user-plus me-1" /> {tx('Novo utilizador')}
          </button>
        )}
      </CabecalhoPagina>
      {erro && <Erro texto={erro} onRepetir={() => { setErro(''); carregar() }} />}

      <div className="row">
        <div className={form ? 'col-xl-8' : 'col-12'}>
          <Painel titulo={tx('Contas')} corpo={false}>
            {!lista && !erro ? <Carregando /> : (
              <div className="table-responsive">
                <table className="table table-striped align-middle mb-0">
                  <thead>
                    <tr><th>{tx('Nome')}</th><th>{tx('Papel')}</th><th>{tx('Estado')}</th><th>{tx('Último acesso')}</th><th className="text-center">{tx('Ações')}</th><th className="text-end" /></tr>
                  </thead>
                  <tbody>
                    {lista?.map((u) => (
                      <tr key={u.id} className={u.ativo ? '' : 'text-muted'}>
                        <td>
                          <div className="d-flex align-items-center">
                            <span className="admin-avatar me-2">{u.nome.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()}</span>
                            <div>
                              <div className="fw-bold">{u.nome} {u.id === eu.id && <span className="badge bg-gray-300 text-gray-800">{tx('eu')}</span>}</div>
                              <div className="small">{u.email}</div>
                            </div>
                          </div>
                        </td>
                        <td><span className={`badge ${CORES_PAPEIS[u.papel] || 'bg-secondary'}`}>{tx(papel(u.papel)?.nome || u.papel)}</span></td>
                        <td>{u.ativo ? <span className="text-success"><i className="fa fa-circle fs-8px me-1" />{tx('Ativo')}</span> : <span><i className="fa fa-circle fs-8px me-1" />{tx('Desativado')}</span>}</td>
                        <td className="text-nowrap">{u.ultimoAcesso ? dataHora(u.ultimoAcesso) : tx('Nunca entrou')}</td>
                        <td className="text-center"><Link to={`/atividades?utilizador=${u.id}`}>{u.atividades}</Link></td>
                        <td className="text-end text-nowrap">
                          {pode('utilizadores.editar') && (u.papel !== 'administrador' || pode('papeis.gerir')) && (
                            <button className="btn btn-sm btn-primary me-1" onClick={() => { setErroForm(''); setForm({ ...u, senha: '' }) }} title={tx('Editar')}><i className="fa fa-pencil-alt" /></button>
                          )}
                          {u.id !== eu.id && pode('utilizadores.editar') && (u.papel !== 'administrador' || pode('papeis.gerir')) && (
                            <button className="btn btn-sm btn-default me-1" onClick={() => reporDoisFatores(u)} title={tx('Repor a verificação em dois passos')}><i className="fa fa-mobile-alt" /></button>
                          )}
                          {u.id !== eu.id && pode('utilizadores.editar') && (u.papel !== 'administrador' || pode('papeis.gerir')) && (
                            <button className={`btn btn-sm ${u.ativo ? 'btn-warning' : 'btn-success'}`} onClick={() => alternarAtivo(u)} title={u.ativo ? tx('Desativar') : tx('Reativar')}>
                              <i className={`fa ${u.ativo ? 'fa-user-slash' : 'fa-user-check'}`} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Painel>
        </div>

        {form && (
          <div className="col-xl-4">
            <Painel titulo={form.id ? tx('Editar utilizador') : tx('Novo utilizador')}>
              <form onSubmit={guardar}>
                {erroForm && <div className="alert alert-danger py-2">{erroForm}</div>}
                <div className="mb-3">
                  <label className="form-label fw-bold" htmlFor="u-nome">{tx('Nome')}</label>
                  <input id="u-nome" className="form-control" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-bold" htmlFor="u-email">{tx('E-mail')}</label>
                  <input id="u-email" type="email" className="form-control" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-bold">{tx('Papel')}</label>
                  {papeisAtribuiveis.map((p) => (
                    <div key={p.id} className="form-check mb-1">
                      <input id={`u-papel-${p.id}`} type="radio" className="form-check-input" name="papel" checked={form.papel === p.id} disabled={form.id === eu.id} onChange={() => setForm({ ...form, papel: p.id })} />
                      <label htmlFor={`u-papel-${p.id}`} className="form-check-label"><b>{p.nome}</b> — <span className="text-muted">{p.descricao}</span></label>
                    </div>
                  ))}
                  {form.id === eu.id && <div className="form-text">{tx('Não pode mudar o seu próprio papel.')}</div>}
                </div>
                <div className="mb-3">
                  <label className="form-label fw-bold" htmlFor="u-senha">{form.id ? tx('Nova palavra-passe (opcional)') : tx('Palavra-passe inicial')}</label>
                  <div className="input-group">
                    <input id="u-senha" className="form-control font-monospace" value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} required={!form.id} placeholder={form.id ? tx('Deixe vazio para manter') : ''} />
                    <button type="button" className="btn btn-default" onClick={() => setForm({ ...form, senha: gerarSenha() })} title={tx('Gerar')}><i className="fa fa-dice" /></button>
                  </div>
                  <div className="form-text">{tx('Mínimo 10 caracteres, com letras e números. A pessoa terá de a mudar ao entrar.')}</div>
                </div>
                <div className="d-flex gap-2 justify-content-end">
                  <button type="button" className="btn btn-white" onClick={() => setForm(null)}>{tx('Cancelar')}</button>
                  <button type="submit" className="btn btn-theme" disabled={aGuardar}>{aGuardar ? tx('A guardar…') : tx('Guardar')}</button>
                </div>
              </form>
            </Painel>
          </div>
        )}
      </div>

      <Confirmar pedido={confirmar} onCancelar={() => setConfirmar(null)} />
      <Aviso aviso={aviso} onFechar={() => setAviso(null)} />
    </>
  )
}

export default Utilizadores
