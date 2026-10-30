import { useCallback, useEffect, useState } from 'react'
import FotoConta from '../../componentes/FotoConta'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { useSessao } from '../../sessaoContexto'
import { Aviso, CabecalhoPagina, Carregando, Erro, Painel } from '../../componentes/Ui'
import { dataHora } from '../../formatar'
import { confirmar } from '../../../portal/dialogos'
import ImportarPessoas from './ImportarPessoas'
import { imprimirFichas } from './fichasAcesso'
import { t as tx } from '../../../i18n/linguas'

const RAMOS = [tx('Exército'), tx('Força Aérea Nacional'), tx('Marinha de Guerra Angolana')]
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
  const [ficha, setFicha] = useState(null) // conta acabada de registar ou com a palavra-passe reposta

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
        setAviso({ texto: tx('Dados atualizados.') })
      } else {
        const c = await api('/academico/contas', { metodo: 'POST', corpo: { tipo: f.tipo, nome: f.nome, email: f.email, dados: dadosDe(f) } })
        setFicha(c)
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
    .then(() => { setAviso({ texto: c.ativo ? tx('Conta desativada (sessões terminadas).') : tx('Conta ativada.') }); carregar() })
    .catch((e) => setAviso({ tipo: 'erro', texto: e.message }))
  async function repor(c) {
    if (!(await confirmar(tx('{0} recebe uma palavra-passe inicial nova (na ficha de acesso) e terá de a mudar ao entrar. A antiga deixa de servir e as sessões abertas terminam.', { 0: c.nome }), { titulo: tx('Repor a palavra-passe'), botao: tx('Repor') }))) return
    await api(`/academico/contas/${c.id}/repor-senha`, { metodo: 'POST' }).then(setFicha).catch((e) => setAviso({ tipo: 'erro', texto: e.message }))
    carregar()
  }

  return (
    <>
      <CabecalhoPagina titulo={tx('Registo de estudantes e docentes')} subtitulo={tx('Repartição de Pessoal e Quadros')} migalhas={[{ rotulo: tx('Pessoal e Quadros') }, { rotulo: tx('Registo') }]}>
        {registar && <button type="button" className="btn btn-white" onClick={() => setImportar(true)}><i className="fa fa-file-excel me-1 text-success" /> {tx('Registar a partir de Excel/CSV')}</button>}
      </CabecalhoPagina>
      {!registar && <div className="alert alert-info py-2"><i className="fa fa-info-circle me-2" />{tx('Registo mantido pela Repartição de Pessoal e Quadros. A Administração Escolar consulta-o para matricular, inscrever e alocar docentes.')}</div>}
      <div className="row">
        <div className={registar ? 'col-xl-8' : 'col-12'}>
          {erro && <Erro texto={erro} onRepetir={carregar} />}
          <Painel titulo={tx('Pessoas registadas{0}', { 0: lista ? ` (${lista.length})` : '' })} corpo={false}>
            <div className="panel-body d-flex gap-2 flex-wrap pb-0">
              <div className="input-group lista-pesquisa">
                <span className="input-group-text"><i className="fa fa-search" /></span>
                <input className="form-control" placeholder={tx('Nome, e-mail ou número…')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={tx('Pesquisar no registo')} />
              </div>
              <select className="form-select w-auto" value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label={tx('Tipo')}>
                <option value="">{tx('Estudantes e docentes')}</option>
                <option value="estudante">{tx('Estudantes')}</option>
                <option value="docente">{tx('Docentes')}</option>
              </select>
            </div>
            {!lista && !erro ? <Carregando /> : (
              <div className="table-responsive mt-3">
                <table className="table table-striped align-middle mb-0">
                  <thead><tr><th>{tx('Nome')}</th><th>{tx('N.º')}</th><th>{tx('Posto / NIP')}</th><th>{tx('Último acesso')}</th><th>{tx('Estado')}</th><th /></tr></thead>
                  <tbody>
                    {lista?.length === 0 && <tr><td colSpan={6} className="text-center text-muted py-4">{tx('Ninguém encontrado.')}</td></tr>}
                    {lista?.map((c) => (
                      <tr key={c.id} className={editar === c.id ? 'table-active' : ''}>
                        <td>
                          {c.tipo === 'estudante' && pode('academico.ver')
                            ? <Link to={`/academico/documentos/estudante/${c.id}/historico`} className="fw-bold" title={tx('Histórico académico')}><FotoConta id={c.id} nome={c.nome} temFoto={c.temFoto} tamanho={30} /> {c.nome}</Link>
                            : <span className="fw-bold"><FotoConta id={c.id} nome={c.nome} temFoto={c.temFoto} tamanho={30} /> {c.nome}</span>}
                          <div className="small text-muted">{c.tipo === 'docente' ? tx('Docente') : tx('Estudante')} · {c.email}</div>
                        </td>
                        <td className="font-monospace">{c.numero}</td>
                        <td className="small">{[c.dados?.posto, c.dados?.ramo, c.dados?.nip && tx('NIP {0}', { 0: c.dados.nip })].filter(Boolean).join(' · ') || '—'}</td>
                        <td className="text-nowrap small">{c.ultimoAcesso ? dataHora(c.ultimoAcesso) : tx('Nunca entrou')}</td>
                        <td>{!c.ativo ? <span className="badge bg-secondary">{tx('Desativada')}</span> : c.deveMudarSenha ? <span className="badge bg-warning text-dark">{tx('Palavra-passe inicial')}</span> : <span className="badge bg-success">{tx('Ativa')}</span>}</td>
                        <td className="text-end text-nowrap">
                          {registar && (
                            <>
                              <button type="button" className="btn btn-sm btn-white me-1" onClick={() => abrirEdicao(c)} title={tx('Editar dados')} aria-label={tx('Editar {0}', { 0: c.nome })}><i className="fa fa-pen" /></button>
                              <button type="button" className="btn btn-sm btn-white me-1" onClick={() => repor(c)} title={tx('Repor a palavra-passe')} aria-label={tx('Repor a palavra-passe de {0}', { 0: c.nome })}><i className="fa fa-key" /></button>
                              <button type="button" className={`btn btn-sm ${c.ativo ? 'btn-white text-danger' : 'btn-success'}`} onClick={() => ativar(c)}>{c.ativo ? tx('Desativar') : tx('Ativar')}</button>
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
            <Painel titulo={editar ? tx('Editar dados') : tx('Registar pessoa')}>
              <form onSubmit={guardar}>
                {erroForm && <div className="alert alert-danger py-2">{erroForm}</div>}
                {!editar && (
                  <div className="btn-group w-100 mb-3" role="group" aria-label={tx('Tipo de pessoa')}>
                    {[['estudante', tx('Estudante'), 'fa-user-graduate'], ['docente', tx('Docente'), 'fa-chalkboard-teacher']].map(([k, t, i]) => (
                      <button key={k} type="button" className={`btn ${f.tipo === k ? 'btn-theme' : 'btn-white'}`} onClick={() => setF({ ...f, tipo: k })} aria-pressed={f.tipo === k}><i className={`fa ${i} me-1`} />{t}</button>
                    ))}
                  </div>
                )}
                <div className="row g-2">
                  <div className="col-12"><label className="form-label fw-bold" htmlFor="r-nome">{tx('Nome completo')}</label><input id="r-nome" className="form-control" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} placeholder={tx('Maj. Nome Apelido')} required /></div>
                  <div className="col-12"><label className="form-label fw-bold" htmlFor="r-email">{tx('E-mail da Escola')}</label><input id="r-email" type="email" className="form-control" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder={tx('nome.apelido@esgfaa.gov.ao')} required /></div>
                  <div className="col-md-6"><label className="form-label" htmlFor="r-posto">{tx('Posto')}</label><input id="r-posto" className="form-control" value={f.posto} onChange={(e) => setF({ ...f, posto: e.target.value })} /></div>
                  <div className="col-md-6"><label className="form-label" htmlFor="r-ramo">{tx('Ramo')}</label><select id="r-ramo" className="form-select" value={f.ramo} onChange={(e) => setF({ ...f, ramo: e.target.value })}><option value="">—</option>{RAMOS.map((r) => <option key={r}>{r}</option>)}</select></div>
                  <div className="col-md-6"><label className="form-label" htmlFor="r-nip">{tx('NIP')}</label><input id="r-nip" className="form-control" value={f.nip} onChange={(e) => setF({ ...f, nip: e.target.value })} /></div>
                  <div className="col-md-6"><label className="form-label" htmlFor="r-tel">{tx('Telefone')}</label><input id="r-tel" className="form-control" value={f.telefone} onChange={(e) => setF({ ...f, telefone: e.target.value })} /></div>
                  {f.tipo === 'docente' && <div className="col-12"><label className="form-label" htmlFor="r-dep">{tx('Departamento')}</label><input id="r-dep" className="form-control" value={f.departamento} onChange={(e) => setF({ ...f, departamento: e.target.value })} /></div>}
                </div>
                {!editar && <div className="form-text mb-3">{tx('O sistema dá uma palavra-passe inicial ao acaso, na ficha de acesso a entregar à pessoa; o portal obriga a mudá-la na primeira entrada.')}</div>}
                <div className="d-flex gap-2 mt-2">
                  <button type="submit" className="btn btn-theme flex-grow-1"><i className={`fa ${editar ? 'fa-save' : 'fa-user-plus'} me-1`} />{editar ? tx('Guardar') : (f.tipo === 'docente' ? tx('Registar docente') : tx('Registar estudante'))}</button>
                  {editar && <button type="button" className="btn btn-white" onClick={() => { setEditar(null); setF(VAZIO) }}>{tx('Cancelar')}</button>}
                </div>
              </form>
            </Painel>
          </div>
        )}
      </div>
      {ficha && <FichaAcesso c={ficha} fechar={() => setFicha(null)} />}
      {importar && <ImportarPessoas fechar={() => setImportar(false)} concluido={carregar} />}
      <Aviso aviso={aviso} onFechar={() => setAviso(null)} />
    </>
  )
}

// a palavra-passe inicial só se vê aqui (uma vez): imprime-se a ficha para entregar em mão
function FichaAcesso({ c, fechar }) {
  return (
    <div className="modal d-block" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="ficha-titulo">
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h4 className="modal-title" id="ficha-titulo"><i className="fa fa-id-card me-2" />{tx('Ficha de acesso ao portal')}</h4>
          </div>
          <div className="modal-body">
            <dl className="row mb-2">
              <dt className="col-5">{tx('Nome')}</dt><dd className="col-7">{c.nome}</dd>
              <dt className="col-5">{tx('Número')}</dt><dd className="col-7 font-monospace">{c.numero}</dd>
              <dt className="col-5">{tx('E-mail (entrada)')}</dt><dd className="col-7">{c.email}</dd>
              <dt className="col-5">{tx('Palavra-passe inicial')}</dt><dd className="col-7 font-monospace fs-5 fw-bold">{c.senhaInicial}</dd>
            </dl>
            <div className="alert alert-warning py-2 small mb-0"><i className="fa fa-exclamation-triangle me-1" />{tx('Esta palavra-passe não volta a ser mostrada. Imprima a ficha e entregue-a em mão; se se perder, use «Repor a palavra-passe».')}</div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-white" onClick={fechar}>{tx('Fechar')}</button>
            <button type="button" className="btn btn-theme" onClick={() => imprimirFichas([c])}><i className="fa fa-print me-1" />{tx('Imprimir ficha (PDF)')}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Registo
