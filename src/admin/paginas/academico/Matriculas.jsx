import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { Aviso, CabecalhoPagina, Carregando, Erro, Painel, Janela } from '../../componentes/Ui'
import FotoConta from '../../componentes/FotoConta'
import { useAnoTrabalho } from '../../anoTrabalho'
import { useSessao } from '../../sessaoContexto'
import { descarregarCsv } from './documentos/csv'
import { t as tx } from '../../../i18n/linguas'

/*
  As matrículas do ano lectivo (o do menu), separadas das turmas: quem está em que turma e em que estado, e matricular
  quem ainda não tem turma neste ano (os estudantes vêm do Sistema de Pessoal; aqui não se regista ninguém).
*/
const ESTADOS = { ativa: 'Activa', suspensa: 'Suspensa', concluida: 'Concluída', anulada: 'Anulada' }
const COR = { ativa: 'bg-success', suspensa: 'bg-warning text-dark', concluida: 'bg-primary', anulada: 'bg-secondary' }
const semAcento = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function Matriculas() {
  const { pode } = useSessao()
  const gerir = pode('academico.gerir')
  const { ano } = useAnoTrabalho()
  const [janela, setJanela] = useState(false)
  const [turmas, setTurmas] = useState(null)
  const [estudantes, setEstudantes] = useState([])
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState(null)
  const [filtro, setFiltro] = useState({ turma: '', estado: '', q: '' })
  const [nova, setNova] = useState({ turma: '', q: '', escolhidos: [] })
  const [aGravar, setAGravar] = useState(false)

  const carregar = useCallback(() => api('/academico/turmas')
    .then((lista) => Promise.all(lista.filter((t) => t.anoLetivo === ano).map((t) => api(`/academico/turmas/${t.id}`))))
    .then((completas) => { setErro(''); setTurmas(completas.sort((a, b) => a.nome.localeCompare(b.nome))) })
    .catch((e) => setErro(e.message)), [ano])
  useEffect(() => { carregar() }, [carregar])
  useEffect(() => { if (gerir) api('/academico/contas?tipo=estudante').then(setEstudantes).catch(() => {}) }, [gerir])

  if (erro) return <Erro texto={erro} onRepetir={carregar} />
  if (!turmas) return <Carregando />

  const linhas = turmas.flatMap((t) => t.matriculas.map((m) => ({ ...m, turma: t })))
  const comTurma = new Set(linhas.filter((m) => m.estado !== 'anulada').map((m) => m.estudante.id))
  const termos = semAcento(filtro.q).split(/\s+/).filter(Boolean)
  const vistas = linhas.filter((m) => (!filtro.turma || String(m.turma.id) === filtro.turma) && (!filtro.estado || m.estado === filtro.estado) && termos.every((x) => semAcento([m.estudante.nome, m.estudante.numero, m.estudante.dados?.nip, m.estudante.dados?.posto].join(' ')).includes(x)))
  const semTurma = estudantes.filter((e) => e.ativo !== false && !comTurma.has(e.id))
  const procura = semAcento(nova.q).split(/\s+/).filter(Boolean)
  const candidatos = semTurma.filter((e) => procura.every((x) => semAcento([e.nome, e.numero, e.dados?.nip].join(' ')).includes(x))).slice(0, 50)

  async function mudarEstado(m, estado) {
    try { await api(`/academico/matriculas/${m.id}`, { metodo: 'PUT', corpo: { estado } }); setAviso({ texto: tx('Matrícula de {0}: {1}.', { 0: m.estudante.nome, 1: tx(ESTADOS[estado]).toLowerCase() }) }); carregar() } catch (e) { setAviso({ tipo: 'erro', texto: e.message }) }
  }
  async function matricular() {
    setAGravar(true)
    let feitas = 0
    const erros = []
    for (const id of nova.escolhidos) {
      try { await api(`/academico/turmas/${nova.turma}/matriculas`, { metodo: 'POST', corpo: { estudanteId: id } }); feitas++ } catch (e) { erros.push(e.message) }
    }
    setAGravar(false)
    setNova({ ...nova, escolhidos: [], q: '' })
    setJanela(false)
    setAviso({ tipo: erros.length ? 'erro' : undefined, texto: [tx('{0} matrícula(s) feita(s).', { 0: feitas }), ...erros].join(' ') })
    carregar()
  }
  const exportar = () => descarregarCsv(`matriculas-${ano}`, [[tx('Matrículas do ano lectivo {0}', { 0: ano })], [], ['N.º', 'NIP', 'Posto', 'Nome', 'Turma', 'Estado'], ...vistas.map((m, i) => [i + 1, m.estudante.dados?.nip ?? '', m.estudante.dados?.posto ?? '', m.estudante.nome, m.turma.nome, ESTADOS[m.estado] ?? m.estado])])
  const contar = (estado) => linhas.filter((m) => m.estado === estado).length

  return (
    <>
      <CabecalhoPagina titulo={tx('Matrículas')} subtitulo={tx('ano lectivo {0} — {1} activa(s), {2} concluída(s) (o ano muda-se no menu)', { 0: ano, 1: contar('ativa'), 2: contar('concluida') })} migalhas={[{ rotulo: tx('Administração Escolar') }, { rotulo: tx('Matrículas') }]}>
        <button type="button" className="btn btn-white" onClick={exportar}><i className="fa fa-file-excel me-1 text-success" />{tx('Exportar Excel')}</button>
      </CabecalhoPagina>
      <div className="row">
        <div className="col-12">
          {gerir && <div className="mb-3 text-end"><button type="button" className="btn btn-theme" onClick={() => setJanela(true)}><i className="fa fa-plus me-1" />{tx('Matricular')}</button></div>}
          <Painel titulo={tx('Estudantes matriculados')} corpo={false}>
            <div className="d-flex flex-wrap gap-2 p-2 border-bottom">
              <select className="form-select form-select-sm w-auto" value={filtro.turma} onChange={(e) => setFiltro({ ...filtro, turma: e.target.value })} aria-label={tx('Turma')}>
                <option value="">{tx('Todas as turmas')}</option>{turmas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
              <select className="form-select form-select-sm w-auto" value={filtro.estado} onChange={(e) => setFiltro({ ...filtro, estado: e.target.value })} aria-label={tx('Estado')}>
                <option value="">{tx('Todos os estados')}</option>{Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{tx(v)}</option>)}
              </select>
              <input className="form-control form-control-sm" style={{ maxWidth: 260 }} placeholder={tx('Procurar (nome, NIP, número)')} value={filtro.q} onChange={(e) => setFiltro({ ...filtro, q: e.target.value })} aria-label={tx('Procurar')} />
              <span className="small text-muted ms-auto align-self-center">{tx('{0} de {1}', { 0: vistas.length, 1: linhas.length })}</span>
            </div>
            <div className="table-responsive">
              <table className="table table-sm table-striped align-middle mb-0">
                <thead><tr><th>{tx('Estudante')}</th><th>{tx('Turma')}</th><th>{tx('Estado')}</th><th /></tr></thead>
                <tbody>
                  {vistas.length === 0 && <tr><td colSpan={4} className="text-center text-muted py-4">{linhas.length ? tx('Ninguém com estes filtros.') : tx('Ainda não há matrículas neste ano lectivo.')}</td></tr>}
                  {vistas.map((m) => (
                    <tr key={m.id}>
                      <td><div className="d-flex align-items-center gap-2"><FotoConta id={m.estudante.id} nome={m.estudante.nome} temFoto={m.estudante.temFoto} tamanho={30} /><div><b>{[m.estudante.dados?.posto, m.estudante.nome].filter(Boolean).join(' ')}</b><div className="small text-muted">{[m.estudante.dados?.nip && `NIP ${m.estudante.dados.nip}`, m.estudante.numero].filter(Boolean).join(' · ')}</div></div></div></td>
                      <td>{m.turma.nome}</td>
                      <td>{gerir
                        ? <select className="form-select form-select-sm w-auto" value={m.estado} onChange={(e) => mudarEstado(m, e.target.value)} aria-label={tx('Estado da matrícula de {0}', { 0: m.estudante.nome })}>{Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{tx(v)}</option>)}</select>
                        : <span className={`badge ${COR[m.estado] ?? 'bg-light text-dark'}`}>{tx(ESTADOS[m.estado] ?? m.estado)}</span>}</td>
                      <td className="text-end text-nowrap">
                        <Link to={`/pessoal/registo/${m.estudante.id}/ficha`} className="btn btn-xs btn-white me-1"><i className="fa fa-id-card me-1" />{tx('Ficha')}</Link>
                        <Link to={`/academico/turmas/${m.turma.id}?aba=estudantes`} className="btn btn-xs btn-white"><i className="fa fa-users me-1" />{tx('Turma')}</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Painel>
        </div>
        {gerir && janela && (
          <Janela titulo={tx('Matricular')} onFechar={() => setJanela(false)}>
            <label className="form-label fw-bold" htmlFor="mat-turma">{tx('1. Turma')}</label>
            <select id="mat-turma" className="form-select mb-3" value={nova.turma} onChange={(e) => setNova({ ...nova, turma: e.target.value })}>
              <option value="">{turmas.length ? tx('— escolha a turma —') : tx('Não há turmas neste ano lectivo')}</option>
              {turmas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
            <label className="form-label fw-bold" htmlFor="mat-q">{tx('2. Estudantes sem turma neste ano ({0})', { 0: semTurma.length })}</label>
            <input id="mat-q" className="form-control mb-2" placeholder={tx('Procurar (nome, NIP)')} value={nova.q} onChange={(e) => setNova({ ...nova, q: e.target.value })} />
            <div className="border rounded mb-2" style={{ maxHeight: 280, overflowY: 'auto' }}>
              {candidatos.length === 0 && <div className="small text-muted p-2">{semTurma.length ? tx('Ninguém com esta procura.') : tx('Todos os estudantes já têm turma neste ano. Os estudantes novos vêm do Sistema de Pessoal.')}</div>}
              {candidatos.map((e) => (
                <label key={e.id} className="d-flex align-items-center gap-2 px-2 py-1 border-bottom small">
                  <input type="checkbox" className="form-check-input" checked={nova.escolhidos.includes(e.id)} onChange={(ev) => setNova({ ...nova, escolhidos: ev.target.checked ? [...nova.escolhidos, e.id] : nova.escolhidos.filter((x) => x !== e.id) })} />
                  <span>{[e.dados?.posto, e.nome].filter(Boolean).join(' ')}{e.dados?.nip && <span className="text-muted"> · NIP {e.dados.nip}</span>}</span>
                </label>
              ))}
            </div>
            <button type="button" className="btn btn-theme w-100" disabled={!nova.turma || !nova.escolhidos.length || aGravar} onClick={matricular}>
              <i className={`fa ${aGravar ? 'fa-spinner fa-spin' : 'fa-user-plus'} me-1`} />{tx('Matricular ({0})', { 0: nova.escolhidos.length })}
            </button>
          </Janela>
        )}
      </div>
      <Aviso aviso={aviso} onFechar={() => setAviso(null)} />
    </>
  )
}

export default Matriculas
