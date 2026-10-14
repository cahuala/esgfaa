import { useCallback, useEffect, useState } from 'react'
import { api } from '../../api'
import { useSessao } from '../../sessaoContexto'
import { Aviso, CabecalhoPagina, Carregando, Confirmar, Erro, Painel } from '../../componentes/Ui'
import { dataHora } from '../../formatar'

// contas do portal (estudantes e docentes): criar docentes, ativar/desativar, repor a palavra-passe
function Contas() {
  const { pode } = useSessao()
  const gerir = pode('academico.gerir')
  const [lista, setLista] = useState(null)
  const [erro, setErro] = useState('')
  const [tipo, setTipo] = useState('')
  const [q, setQ] = useState('')
  const [f, setF] = useState({ nome: '', email: '', departamento: '' })
  const [erroForm, setErroForm] = useState('')
  const [aviso, setAviso] = useState(null)
  const [confirmar, setConfirmar] = useState(null)

  const carregar = useCallback(() => {
    const p = new URLSearchParams()
    if (tipo) p.set('tipo', tipo)
    if (q.trim()) p.set('q', q.trim())
    return api(`/academico/contas?${p}`).then((r) => { setErro(''); setLista(r) }).catch((e) => setErro(e.message))
  }, [tipo, q])
  useEffect(() => {
    const t = setTimeout(carregar, 250)
    return () => clearTimeout(t)
  }, [carregar])

  async function criarDocente(e) {
    e.preventDefault()
    setErroForm('')
    try {
      const c = await api('/academico/contas', { metodo: 'POST', corpo: { tipo: 'docente', nome: f.nome, email: f.email, dados: { departamento: f.departamento } } })
      setF({ nome: '', email: '', departamento: '' })
      setAviso({ texto: `Docente criado (n.º ${c.numero}). Entra com ${c.email} e essa mesma palavra-passe na primeira vez.` })
      carregar()
    } catch (falha) {
      setErroForm(falha.message)
    }
  }

  const ativar = (c) => api(`/academico/contas/${c.id}`, { metodo: 'PUT', corpo: { ativo: !c.ativo } })
    .then(() => { setAviso({ texto: c.ativo ? 'Conta desativada (sessões terminadas).' : 'Conta ativada.' }); carregar() })
    .catch((e) => setAviso({ tipo: 'erro', texto: e.message }))

  const repor = (c) => setConfirmar({
    titulo: 'Repor a palavra-passe',
    texto: <>A palavra-passe de <b>{c.nome}</b> volta a ser o e-mail ({c.email}) e terá de a mudar ao entrar. As sessões abertas terminam.</>,
    botao: 'Repor',
    confirmar: async () => {
      setConfirmar(null)
      await api(`/academico/contas/${c.id}/repor-senha`, { metodo: 'POST' })
        .then(() => setAviso({ texto: 'Palavra-passe reposta.' })).catch((e) => setAviso({ tipo: 'erro', texto: e.message }))
      carregar()
    },
  })

  return (
    <>
      <CabecalhoPagina titulo="Contas do portal" subtitulo="estudantes e docentes" migalhas={[{ rotulo: 'Administração Escolar' }, { rotulo: 'Contas do portal' }]} />
      <div className="alert alert-info py-2"><i className="fa fa-info-circle me-2" />Os estudantes são criados ao fazer a matrícula (em Turmas). A palavra-passe inicial de cada conta é o próprio e-mail da Escola e tem de ser mudada na primeira entrada.</div>
      <div className="row">
        <div className={gerir ? 'col-xl-8' : 'col-12'}>
          {erro && <Erro texto={erro} onRepetir={carregar} />}
          <Painel titulo={`Contas${lista ? ` (${lista.length})` : ''}`} corpo={false}>
            <div className="panel-body d-flex gap-2 flex-wrap pb-0">
              <div className="input-group lista-pesquisa">
                <span className="input-group-text"><i className="fa fa-search" /></span>
                <input className="form-control" placeholder="Nome, e-mail ou número…" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              <select className="form-select w-auto" value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Tipo">
                <option value="">Estudantes e docentes</option>
                <option value="estudante">Estudantes</option>
                <option value="docente">Docentes</option>
              </select>
            </div>
            {!lista && !erro ? <Carregando /> : (
              <div className="table-responsive mt-3">
                <table className="table table-striped align-middle mb-0">
                  <thead><tr><th>Nome</th><th>N.º</th><th>Tipo</th><th>Último acesso</th><th>Estado</th><th /></tr></thead>
                  <tbody>
                    {lista?.length === 0 && <tr><td colSpan={6} className="text-center text-muted py-4">Sem contas.</td></tr>}
                    {lista?.map((c) => (
                      <tr key={c.id}>
                        <td><span className="fw-bold">{c.nome}</span><div className="small text-muted">{c.email}</div></td>
                        <td className="font-monospace">{c.numero}</td>
                        <td>{c.tipo === 'docente' ? 'Docente' : 'Estudante'}</td>
                        <td className="text-nowrap">{c.ultimoAcesso ? dataHora(c.ultimoAcesso) : 'Nunca entrou'}</td>
                        <td>
                          {!c.ativo ? <span className="badge bg-secondary">Desativada</span> : c.deveMudarSenha ? <span className="badge bg-warning text-dark">Palavra-passe inicial</span> : <span className="badge bg-success">Ativa</span>}
                        </td>
                        <td className="text-end text-nowrap">
                          {gerir && (
                            <>
                              <button type="button" className="btn btn-sm btn-white me-1" onClick={() => repor(c)} title="Repor a palavra-passe"><i className="fa fa-key" /></button>
                              <button type="button" className={`btn btn-sm ${c.ativo ? 'btn-white text-danger' : 'btn-success'}`} onClick={() => ativar(c)}>{c.ativo ? 'Desativar' : 'Ativar'}</button>
                            </>
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
        {gerir && (
          <div className="col-xl-4">
            <Painel titulo="Novo docente">
              <form onSubmit={criarDocente}>
                {erroForm && <div className="alert alert-danger py-2">{erroForm}</div>}
                <label className="form-label fw-bold" htmlFor="d-nome">Nome completo</label>
                <input id="d-nome" className="form-control mb-3" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} placeholder="Cor. Nome Apelido" required />
                <label className="form-label fw-bold" htmlFor="d-email">E-mail da Escola</label>
                <input id="d-email" type="email" className="form-control mb-3" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="nome.apelido@esgfaa.gov.ao" required />
                <label className="form-label" htmlFor="d-dep">Departamento</label>
                <input id="d-dep" className="form-control mb-3" value={f.departamento} onChange={(e) => setF({ ...f, departamento: e.target.value })} />
                <button type="submit" className="btn btn-theme w-100"><i className="fa fa-chalkboard-teacher me-1" /> Criar docente</button>
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

export default Contas
