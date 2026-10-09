import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useSessao } from '../sessaoContexto'
import { Aviso, CabecalhoPagina, Carregando, Confirmar, Erro, Painel } from '../componentes/Ui'
import { dataHora } from '../formatar'

const VAZIO = { nome: '', email: '', papel: 'editor', senha: '' }
const PAPEIS = {
  administrador: { rotulo: 'Administrador', cor: 'bg-danger', descricao: 'Tudo, incluindo utilizadores e registo de atividades.' },
  editor: { rotulo: 'Editor', cor: 'bg-teal', descricao: 'Conteúdos, páginas e comentários.' },
}

// palavra-passe aleatória e forte para novos utilizadores
function gerarSenha() {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz'
  const numeros = '23456789'
  const valores = crypto.getRandomValues(new Uint32Array(12))
  const s = Array.from(valores, (v, i) => (i % 4 === 3 ? numeros[v % numeros.length] : letras[v % letras.length]))
  return s.join('')
}

function Utilizadores() {
  const { utilizador: eu } = useSessao()
  const [lista, setLista] = useState(null)
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

  async function guardar(e) {
    e.preventDefault()
    setErroForm('')
    setAGuardar(true)
    try {
      const corpo = { nome: form.nome, email: form.email, papel: form.papel }
      if (form.senha) corpo.senha = form.senha
      if (form.id) await api(`/utilizadores/${form.id}`, { metodo: 'PUT', corpo })
      else await api('/utilizadores', { metodo: 'POST', corpo })
      setAviso({ texto: form.id ? 'Utilizador atualizado.' : `Utilizador criado. Comunique a palavra-passe a ${form.nome} por um canal seguro.` })
      setForm(null)
      carregar()
    } catch (falha) {
      setErroForm(falha.message)
    } finally {
      setAGuardar(false)
    }
  }

  function alternarAtivo(u) {
    setConfirmar({
      titulo: u.ativo ? 'Desativar utilizador' : 'Reativar utilizador',
      texto: u.ativo
        ? <><b>{u.nome}</b> deixa de conseguir entrar no painel. O histórico das suas ações mantém-se.</>
        : <><b>{u.nome}</b> volta a poder entrar no painel.</>,
      botao: u.ativo ? 'Desativar' : 'Reativar',
      perigo: u.ativo,
      confirmar: async () => {
        setConfirmar(null)
        try {
          await api(`/utilizadores/${u.id}`, { metodo: 'PUT', corpo: { ativo: !u.ativo } })
          setAviso({ texto: u.ativo ? 'Utilizador desativado.' : 'Utilizador reativado.' })
          carregar()
        } catch (e) {
          setAviso({ tipo: 'erro', texto: e.message })
        }
      },
    })
  }

  return (
    <>
      <CabecalhoPagina titulo="Utilizadores" subtitulo="quem pode entrar no painel" migalhas={[{ rotulo: 'Utilizadores' }]}>
        <button className="btn btn-theme" onClick={() => { setErroForm(''); setForm({ ...VAZIO, senha: gerarSenha() }) }}>
          <i className="fa fa-user-plus me-1" /> Novo utilizador
        </button>
      </CabecalhoPagina>
      {erro && <Erro texto={erro} onRepetir={() => { setErro(''); carregar() }} />}

      <div className="row">
        <div className={form ? 'col-xl-8' : 'col-12'}>
          <Painel titulo="Contas" corpo={false}>
            {!lista && !erro ? <Carregando /> : (
              <div className="table-responsive">
                <table className="table table-striped align-middle mb-0">
                  <thead>
                    <tr><th>Nome</th><th>Papel</th><th>Estado</th><th>Último acesso</th><th className="text-center">Ações</th><th className="text-end" /></tr>
                  </thead>
                  <tbody>
                    {lista?.map((u) => (
                      <tr key={u.id} className={u.ativo ? '' : 'text-muted'}>
                        <td>
                          <div className="d-flex align-items-center">
                            <span className="admin-avatar me-2">{u.nome.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()}</span>
                            <div>
                              <div className="fw-bold">{u.nome} {u.id === eu.id && <span className="badge bg-gray-300 text-gray-800">eu</span>}</div>
                              <div className="small">{u.email}</div>
                            </div>
                          </div>
                        </td>
                        <td><span className={`badge ${PAPEIS[u.papel].cor}`}>{PAPEIS[u.papel].rotulo}</span></td>
                        <td>{u.ativo ? <span className="text-success"><i className="fa fa-circle fs-8px me-1" />Ativo</span> : <span><i className="fa fa-circle fs-8px me-1" />Desativado</span>}</td>
                        <td className="text-nowrap">{u.ultimoAcesso ? dataHora(u.ultimoAcesso) : 'Nunca entrou'}</td>
                        <td className="text-center"><Link to={`/atividades?utilizador=${u.id}`}>{u.atividades}</Link></td>
                        <td className="text-end text-nowrap">
                          <button className="btn btn-sm btn-primary me-1" onClick={() => { setErroForm(''); setForm({ ...u, senha: '' }) }} title="Editar"><i className="fa fa-pencil-alt" /></button>
                          {u.id !== eu.id && (
                            <button className={`btn btn-sm ${u.ativo ? 'btn-warning' : 'btn-success'}`} onClick={() => alternarAtivo(u)} title={u.ativo ? 'Desativar' : 'Reativar'}>
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
            <Painel titulo={form.id ? 'Editar utilizador' : 'Novo utilizador'}>
              <form onSubmit={guardar}>
                {erroForm && <div className="alert alert-danger py-2">{erroForm}</div>}
                <div className="mb-3">
                  <label className="form-label fw-bold" htmlFor="u-nome">Nome</label>
                  <input id="u-nome" className="form-control" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-bold" htmlFor="u-email">E-mail</label>
                  <input id="u-email" type="email" className="form-control" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-bold">Papel</label>
                  {Object.entries(PAPEIS).map(([chave, p]) => (
                    <div key={chave} className="form-check mb-1">
                      <input id={`u-papel-${chave}`} type="radio" className="form-check-input" name="papel" checked={form.papel === chave} onChange={() => setForm({ ...form, papel: chave })} />
                      <label htmlFor={`u-papel-${chave}`} className="form-check-label"><b>{p.rotulo}</b> — <span className="text-muted">{p.descricao}</span></label>
                    </div>
                  ))}
                </div>
                <div className="mb-3">
                  <label className="form-label fw-bold" htmlFor="u-senha">{form.id ? 'Nova palavra-passe (opcional)' : 'Palavra-passe inicial'}</label>
                  <div className="input-group">
                    <input id="u-senha" className="form-control font-monospace" value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} required={!form.id} placeholder={form.id ? 'Deixe vazio para manter' : ''} />
                    <button type="button" className="btn btn-default" onClick={() => setForm({ ...form, senha: gerarSenha() })} title="Gerar"><i className="fa fa-dice" /></button>
                  </div>
                  <div className="form-text">Mínimo 8 caracteres, com letras e números.</div>
                </div>
                <div className="d-flex gap-2 justify-content-end">
                  <button type="button" className="btn btn-white" onClick={() => setForm(null)}>Cancelar</button>
                  <button type="submit" className="btn btn-theme" disabled={aGuardar}>{aGuardar ? 'A guardar…' : 'Guardar'}</button>
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
