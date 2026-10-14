import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { useSessao } from '../../sessaoContexto'
import { Aviso, CabecalhoPagina, Carregando, Erro, Painel } from '../../componentes/Ui'
import { dataHora } from '../../formatar'
import { confirmar } from '../../../portal/dialogos'
import ImportarPessoas from './ImportarPessoas'

const RAMOS = ['Exército', 'Força Aérea Nacional', 'Marinha de Guerra Angolana']
const VAZIO = { tipo: 'estudante', nome: '', email: '', posto: '', ramo: '', nip: '', telefone: '', departamento: '' }

/*
  Registo de estudantes e docentes (Repartição de Pessoal e Quadros): dados pessoais e conta do portal.
  A Administração Escolar vê esta lista só para consultar; matricula e aloca a partir dela.
*/
function Registo() {
  const { pode } = useSessao()
  const registar = pode('pessoal.registar')
  const [lista, setLista] = useState(null)
  const [erro, setErro] = useState('')
  const [tipo, setTipo] = useState('')
  const [q, setQ] = useState('')
  const [f, setF] = useState(VAZIO)
  const [editar, setEditar] = useState(null) // id da pessoa em edição
  const [erroForm, setErroForm] = useState('')
  const [aviso, setAviso] = useState(null)
  const [importar, setImportar] = useState(false)

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

  const dadosDe = (x) => ({ posto: x.posto, ramo: x.ramo, nip: x.nip, telefone: x.telefone, ...(x.tipo === 'docente' ? { departamento: x.departamento } : {}) })
  async function guardar(e) {
    e.preventDefault()
    setErroForm('')
    try {
      if (editar) {
        await api(`/academico/contas/${editar}`, { metodo: 'PUT', corpo: { nome: f.nome, email: f.email, dados: dadosDe(f) } })
        setAviso({ texto: 'Dados atualizados.' })
      } else {
        const c = await api('/academico/contas', { metodo: 'POST', corpo: { tipo: f.tipo, nome: f.nome, email: f.email, dados: dadosDe(f) } })
        setAviso({ texto: `${f.tipo === 'docente' ? 'Docente' : 'Estudante'} registado (n.º ${c.numero}). Entra no portal com ${c.email} e essa mesma palavra-passe na primeira vez.` })
      }
      setF(VAZIO)
      setEditar(null)
      carregar()
    } catch (falha) {
      setErroForm(falha.message)
    }
  }
  const abrirEdicao = (c) => {
    setEditar(c.id)
    setErroForm('')
    setF({ tipo: c.tipo, nome: c.nome, email: c.email, posto: c.dados?.posto || '', ramo: c.dados?.ramo || '', nip: c.dados?.nip || '', telefone: c.dados?.telefone || '', departamento: c.dados?.departamento || '' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const ativar = (c) => api(`/academico/contas/${c.id}`, { metodo: 'PUT', corpo: { ativo: !c.ativo } })
    .then(() => { setAviso({ texto: c.ativo ? 'Conta desativada (sessões terminadas).' : 'Conta ativada.' }); carregar() })
    .catch((e) => setAviso({ tipo: 'erro', texto: e.message }))
  async function repor(c) {
    if (!(await confirmar(`A palavra-passe de ${c.nome} volta a ser o e-mail (${c.email}) e terá de a mudar ao entrar. As sessões abertas terminam.`, { titulo: 'Repor a palavra-passe', botao: 'Repor' }))) return
    await api(`/academico/contas/${c.id}/repor-senha`, { metodo: 'POST' }).then(() => setAviso({ texto: 'Palavra-passe reposta.' })).catch((e) => setAviso({ tipo: 'erro', texto: e.message }))
    carregar()
  }

  return (
    <>
      <CabecalhoPagina titulo="Registo de estudantes e docentes" subtitulo="Repartição de Pessoal e Quadros" migalhas={[{ rotulo: 'Pessoal e Quadros' }, { rotulo: 'Registo' }]}>
        {registar && <button type="button" className="btn btn-white" onClick={() => setImportar(true)}><i className="fa fa-file-excel me-1 text-success" /> Registar a partir de Excel/CSV</button>}
      </CabecalhoPagina>
      {!registar && <div className="alert alert-info py-2"><i className="fa fa-info-circle me-2" />Registo mantido pela Repartição de Pessoal e Quadros. A Administração Escolar consulta-o para matricular, inscrever e alocar docentes.</div>}
      <div className="row">
        <div className={registar ? 'col-xl-8' : 'col-12'}>
          {erro && <Erro texto={erro} onRepetir={carregar} />}
          <Painel titulo={`Pessoas registadas${lista ? ` (${lista.length})` : ''}`} corpo={false}>
            <div className="panel-body d-flex gap-2 flex-wrap pb-0">
              <div className="input-group lista-pesquisa">
                <span className="input-group-text"><i className="fa fa-search" /></span>
                <input className="form-control" placeholder="Nome, e-mail ou número…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Pesquisar no registo" />
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
                  <thead><tr><th>Nome</th><th>N.º</th><th>Posto / NIP</th><th>Último acesso</th><th>Estado</th><th /></tr></thead>
                  <tbody>
                    {lista?.length === 0 && <tr><td colSpan={6} className="text-center text-muted py-4">Ninguém encontrado.</td></tr>}
                    {lista?.map((c) => (
                      <tr key={c.id} className={editar === c.id ? 'table-active' : ''}>
                        <td>
                          {c.tipo === 'estudante' && pode('academico.ver')
                            ? <Link to={`/academico/documentos/estudante/${c.id}/historico`} className="fw-bold" title="Histórico académico">{c.nome}</Link>
                            : <span className="fw-bold">{c.nome}</span>}
                          <div className="small text-muted">{c.tipo === 'docente' ? 'Docente' : 'Estudante'} · {c.email}</div>
                        </td>
                        <td className="font-monospace">{c.numero}</td>
                        <td className="small">{[c.dados?.posto, c.dados?.ramo, c.dados?.nip && `NIP ${c.dados.nip}`].filter(Boolean).join(' · ') || '—'}</td>
                        <td className="text-nowrap small">{c.ultimoAcesso ? dataHora(c.ultimoAcesso) : 'Nunca entrou'}</td>
                        <td>{!c.ativo ? <span className="badge bg-secondary">Desativada</span> : c.deveMudarSenha ? <span className="badge bg-warning text-dark">Palavra-passe inicial</span> : <span className="badge bg-success">Ativa</span>}</td>
                        <td className="text-end text-nowrap">
                          {registar && (
                            <>
                              <button type="button" className="btn btn-sm btn-white me-1" onClick={() => abrirEdicao(c)} title="Editar dados" aria-label={`Editar ${c.nome}`}><i className="fa fa-pen" /></button>
                              <button type="button" className="btn btn-sm btn-white me-1" onClick={() => repor(c)} title="Repor a palavra-passe" aria-label={`Repor a palavra-passe de ${c.nome}`}><i className="fa fa-key" /></button>
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
        {registar && (
          <div className="col-xl-4">
            <Painel titulo={editar ? 'Editar dados' : 'Registar pessoa'}>
              <form onSubmit={guardar}>
                {erroForm && <div className="alert alert-danger py-2">{erroForm}</div>}
                {!editar && (
                  <div className="btn-group w-100 mb-3" role="group" aria-label="Tipo de pessoa">
                    {[['estudante', 'Estudante', 'fa-user-graduate'], ['docente', 'Docente', 'fa-chalkboard-teacher']].map(([k, t, i]) => (
                      <button key={k} type="button" className={`btn ${f.tipo === k ? 'btn-theme' : 'btn-white'}`} onClick={() => setF({ ...f, tipo: k })} aria-pressed={f.tipo === k}><i className={`fa ${i} me-1`} />{t}</button>
                    ))}
                  </div>
                )}
                <div className="row g-2">
                  <div className="col-12"><label className="form-label fw-bold" htmlFor="r-nome">Nome completo</label><input id="r-nome" className="form-control" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} placeholder="Maj. Nome Apelido" required /></div>
                  <div className="col-12"><label className="form-label fw-bold" htmlFor="r-email">E-mail da Escola</label><input id="r-email" type="email" className="form-control" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="nome.apelido@esgfaa.gov.ao" required /></div>
                  <div className="col-md-6"><label className="form-label" htmlFor="r-posto">Posto</label><input id="r-posto" className="form-control" value={f.posto} onChange={(e) => setF({ ...f, posto: e.target.value })} /></div>
                  <div className="col-md-6"><label className="form-label" htmlFor="r-ramo">Ramo</label><select id="r-ramo" className="form-select" value={f.ramo} onChange={(e) => setF({ ...f, ramo: e.target.value })}><option value="">—</option>{RAMOS.map((r) => <option key={r}>{r}</option>)}</select></div>
                  <div className="col-md-6"><label className="form-label" htmlFor="r-nip">NIP</label><input id="r-nip" className="form-control" value={f.nip} onChange={(e) => setF({ ...f, nip: e.target.value })} /></div>
                  <div className="col-md-6"><label className="form-label" htmlFor="r-tel">Telefone</label><input id="r-tel" className="form-control" value={f.telefone} onChange={(e) => setF({ ...f, telefone: e.target.value })} /></div>
                  {f.tipo === 'docente' && <div className="col-12"><label className="form-label" htmlFor="r-dep">Departamento</label><input id="r-dep" className="form-control" value={f.departamento} onChange={(e) => setF({ ...f, departamento: e.target.value })} /></div>}
                </div>
                {!editar && <div className="form-text mb-3">A palavra-passe inicial é o próprio e-mail; o portal obriga a mudá-la na primeira entrada.</div>}
                <div className="d-flex gap-2 mt-2">
                  <button type="submit" className="btn btn-theme flex-grow-1"><i className={`fa ${editar ? 'fa-save' : 'fa-user-plus'} me-1`} />{editar ? 'Guardar' : `Registar ${f.tipo === 'docente' ? 'docente' : 'estudante'}`}</button>
                  {editar && <button type="button" className="btn btn-white" onClick={() => { setEditar(null); setF(VAZIO) }}>Cancelar</button>}
                </div>
              </form>
            </Painel>
          </div>
        )}
      </div>
      {importar && <ImportarPessoas fechar={() => setImportar(false)} concluido={carregar} />}
      <Aviso aviso={aviso} onFechar={() => setAviso(null)} />
    </>
  )
}

export default Registo
