import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useSessao } from '../sessaoContexto'
import { t as tx, localAtual } from '../../i18n/linguas'
import { useAnoTrabalho } from '../anoTrabalho'

/*
  O painel inicial de quem não trata do site: o que cada papel precisa de ver logo ao entrar.
  - gestão académica (Repartição, Director de Ensino, Comandante): números da Escola e o que espera por si
    (homologações, alterações de notas, docentes por verificar, provas por imprimir, pedidos);
  - Pessoal e Quadros: estudantes e docentes registados;
  - biblioteca: empréstimos, atrasos e reservas;
  - cibersegurança: o estado de alerta e os eventos de hoje.
*/
function Numero({ cor, icone, titulo, valor, extra, para }) {
  return (
    <div className="col-xl-3 col-md-6">
      <div className={`widget widget-stats ${cor}`}>
        <div className="stats-icon"><i className={`fa ${icone}`} /></div>
        <div className="stats-info"><h4>{titulo}</h4><p>{Number(valor ?? 0).toLocaleString(localAtual())}</p></div>
        <div className="stats-link"><Link to={para}>{extra} <i className="fa fa-arrow-alt-circle-right" /></Link></div>
      </div>
    </div>
  )
}

function Tarefa({ para, icone, cor, texto, valor }) {
  return (
    <Link to={para} className="list-group-item list-group-item-action d-flex align-items-center gap-2 py-3">
      <span className={`badge ${cor} rounded-circle d-inline-grid`} style={{ width: 34, height: 34, placeItems: 'center' }}><i className={`fa ${icone}`} /></span>
      <span className="flex-grow-1 fw-bold">{texto}</span>
      {valor !== undefined && <span className={`badge rounded-pill ${valor ? 'bg-danger' : 'bg-gray-400'}`}>{valor}</span>}
      <i className="fa fa-chevron-right text-muted" />
    </Link>
  )
}

// os atalhos do trabalho de todos os dias da Administração Escolar (como o painel do Pessoal e Quadros)
const ATALHOS_ENSINO = [
  ['/pessoal/registo', 'fa-id-card', 'Fichas', 'estudantes e docentes', 'academico.ver'],
  ['/academico/turmas', 'fa-users', 'Turmas', 'e os seus estudantes', 'academico.ver'],
  ['/academico/matriculas', 'fa-user-plus', 'Matrículas', 'quem está em que turma', 'academico.ver'],
  ['/academico/lancar-notas', 'fa-pen', 'Lançar notas', 'por cadeira', 'academico.notas'],
  ['/academico/pautas', 'fa-table', 'Pautas', 'por curso e cadeira', 'academico.ver'],
  ['/academico/documentos', 'fa-print', 'Documentos', 'listas, diplomas, ofícios…', 'academico.ver'],
  ['/academico/pedidos', 'fa-file-signature', 'Pedidos', 'de documentos', 'academico.ver'],
  ['/academico/alocacao', 'fa-chalkboard-teacher', 'Docentes', 'nas cadeiras', 'academico.ver'],
]
function Atalhos({ pode }) {
  return (
    <div className="panel panel-inverse">
      <div className="panel-heading"><h4 className="panel-title"><i className="fa fa-bolt me-2" />{tx('Trabalho do dia')}</h4></div>
      <div className="panel-body">
        <div className="row g-2">
          {ATALHOS_ENSINO.filter((a) => pode(a[4])).map(([para, icone, titulo, sub]) => (
            <div key={para} className="col-xl-3 col-md-4 col-6">
              <Link to={para} className="btn btn-white w-100 h-100 text-start py-3 d-flex align-items-center gap-3">
                <i className={`fa ${icone} fa-2x`} style={{ color: '#861d0c', width: 36 }} />
                <span><b className="d-block">{tx(titulo)}</b><span className="small text-muted">{tx(sub)}</span></span>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
// o ano lectivo por curso: as turmas, os estudantes e as cadeiras
function PorCurso({ ano }) {
  const [turmas, setTurmas] = useState(null)
  const [cursos, setCursos] = useState([])
  useEffect(() => {
    api('/academico/turmas').then(setTurmas).catch(() => setTurmas([]))
    api('/colecoes/cursos').then(setCursos).catch(() => {})
  }, [])
  if (!turmas) return null
  const doAno = turmas.filter((t) => t.anoLetivo === ano)
  if (!doAno.length) return null
  const nome = (id) => cursos.find((c) => c.id === id)?.nome ?? id
  const linhas = [...new Set(doAno.map((t) => t.curso))].map((c) => {
    const ts = doAno.filter((t) => t.curso === c)
    return { c, turmas: ts.length, estudantes: ts.reduce((a, t) => a + (t.estudantes ?? 0), 0), cadeiras: ts.reduce((a, t) => a + (t.cadeiras ?? 0), 0) }
  }).sort((a, b) => nome(a.c).localeCompare(nome(b.c)))
  return (
    <div className="panel panel-inverse">
      <div className="panel-heading"><h4 className="panel-title"><i className="fa fa-graduation-cap me-2" />{tx('O ano lectivo {0} por curso', { 0: ano })}</h4></div>
      <div className="table-responsive">
        <table className="table table-striped align-middle mb-0">
          <thead><tr><th>{tx('Curso')}</th><th className="text-end">{tx('Turmas')}</th><th className="text-end">{tx('Estudantes')}</th><th className="text-end">{tx('Cadeiras')}</th><th /></tr></thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.c}><td className="fw-bold">{nome(l.c)}</td><td className="text-end">{l.turmas}</td><td className="text-end">{l.estudantes}</td><td className="text-end">{l.cadeiras}</td>
                <td className="text-end"><Link to="/academico/pautas" className="btn btn-xs btn-white"><i className="fa fa-table me-1" />{tx('Pautas')}</Link></td></tr>
            ))}
            <tr className="fw-bold"><td>{tx('Total')}</td><td className="text-end">{linhas.reduce((a, l) => a + l.turmas, 0)}</td><td className="text-end">{linhas.reduce((a, l) => a + l.estudantes, 0)}</td><td className="text-end">{linhas.reduce((a, l) => a + l.cadeiras, 0)}</td><td /></tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function PainelPapel() {
  const { pode } = useSessao()
  // os números do ano lectivo de trabalho (o actual, ou o escolhido na conta)
  const { ano } = useAnoTrabalho()
  const [ac, setAc] = useState(null)
  const [bib, setBib] = useState(null)
  const [seg, setSeg] = useState(null)
  const [contas, setContas] = useState(null)
  const [porAprovar, setPorAprovar] = useState(null)
  const verAc = pode('academico.ver')
  const verBib = pode('biblioteca.ver')
  const verSeg = pode('seguranca.ver')
  const verPes = pode('pessoal.ver')
  const aprova = pode('publicacoes.aprovar') || pode('utilizadores.aprovar')
  useEffect(() => {
    if (verAc && ano) api(`/academico/pendentes?anoLetivo=${encodeURIComponent(ano)}`).then(setAc).catch(() => {})
    if (verBib) api('/biblioteca').then(setBib).catch(() => {})
    if (verSeg) api('/seguranca').then(setSeg).catch(() => {})
    if (verPes && ano) api(`/academico/contas?anoLetivo=${encodeURIComponent(ano)}`).then(setContas).catch(() => {})
    if (aprova) api('/publicacoes/contagem').then((r) => setPorAprovar(r.pendentes)).catch(() => {})
  }, [verAc, verBib, verSeg, verPes, aprova, ano])

  const homologa = pode('academico.homologar')
  const conselho = pode('academico.conselho')
  const gere = pode('academico.gerir')
  const tarefas = (ac || porAprovar !== null) && [
    aprova && { para: '/publicacoes', icone: 'fa-stamp', cor: 'bg-danger', texto: tx('Por aprovar: site, avisos e inquéritos do portal, contas do painel'), valor: porAprovar ?? 0 },
    ...(!ac ? [] : [
    homologa && { para: '/academico/alteracoes-notas', icone: 'fa-user-shield', cor: 'bg-danger', texto: tx('Pedidos de alteração de notas por decidir'), valor: ac.alteracoesPendentes },
    homologa && { para: '/academico/docentes', icone: 'fa-user-check', cor: 'bg-warning text-dark', texto: tx('Docentes por verificar'), valor: ac.docentesPorVerificar },
    ...(homologa ? ac.porHomologar.map((t) => ({ para: `/academico/turmas/${t.id}?aba=plano`, icone: 'fa-stamp', cor: 'bg-dark', texto: tx('Homologar as classificações: {0}', { 0: t.nome }) })) : []),
    ...(conselho ? ac.porConfirmar.map((t) => ({ para: `/academico/turmas/${t.id}?aba=plano`, icone: 'fa-gavel', cor: 'bg-dark', texto: tx('Confirmar em Conselho de Curso: {0}', { 0: t.nome }) })) : []),
    conselho && ac.revisoes > 0 && { para: '/academico/turmas', icone: 'fa-search', cor: 'bg-info', texto: tx('Pedidos de revisão de provas por decidir'), valor: ac.revisoes },
    gere && { para: '/academico/provas-escritas', icone: 'fa-print', cor: 'bg-primary', texto: tx('Provas escritas para imprimir'), valor: ac.provasPorImprimir },
    gere && { para: '/academico/pedidos', icone: 'fa-file-signature', cor: 'bg-teal', texto: tx('Pedidos de documentos por tratar'), valor: ac.pedidosDocumentos },
    ]),
  ].filter(Boolean)
  const docentes = contas?.filter((c) => c.tipo === 'docente').length
  const estudantes = contas?.filter((c) => c.tipo === 'estudante').length
  if (!ac && !bib && !seg && !contas && porAprovar === null) return null

  return (
    <>
      <div className="row">
        {ac && <>
          <Numero cor="esg-w-vermelho" icone="fa-users" titulo={tx('TURMAS ACTIVAS')} valor={ac.turmas} extra={tx('Turmas e matrículas')} para="/academico/turmas" />
          <Numero cor="esg-w-preto" icone="fa-user-graduate" titulo={`${tx('ESTUDANTES MATRICULADOS')} ${ano}`} valor={ac.estudantes} extra={tx('Indicadores')} para="/academico/indicadores" />
          <Numero cor="esg-w-dourado" icone="fa-chalkboard-teacher" titulo={tx('DOCENTES')} valor={ac.docentes} extra={homologa ? tx('{0} por verificar', { 0: ac.docentesPorVerificar }) : tx('Alocação de docentes')} para={homologa ? '/academico/docentes' : '/academico/alocacao'} />
          <Numero cor="esg-w-cinza" icone="fa-hourglass-half" titulo={tx('À ESPERA DE DECISÃO')} valor={(tarefas ?? []).reduce((s, t) => s + (t.valor ?? 1), 0)} extra={tx('Ver abaixo')} para="/" />
        </>}
        {!ac && contas && <>
          <Numero cor="esg-w-vermelho" icone="fa-user-graduate" titulo={tx('ESTUDANTES REGISTADOS')} valor={estudantes} extra={tx('Registo de pessoas')} para="/pessoal/registo" />
          <Numero cor="esg-w-preto" icone="fa-chalkboard-teacher" titulo={tx('DOCENTES REGISTADOS')} valor={docentes} extra={tx('Registo de pessoas')} para="/pessoal/registo" />
        </>}
        {bib && <>
          <Numero cor="esg-w-vermelho" icone="fa-book" titulo={tx('OBRAS NO CATÁLOGO')} valor={bib.obras} extra={tx('{0} exemplares', { 0: bib.exemplares })} para="/biblioteca/catalogo" />
          <Numero cor="esg-w-preto" icone="fa-hand-holding" titulo={tx('EMPRESTADOS')} valor={bib.ativos} extra={tx('Empréstimos')} para="/biblioteca/emprestimos" />
          <Numero cor="esg-w-dourado" icone="fa-clock" titulo={tx('EM ATRASO')} valor={bib.atrasados} extra={tx('Ver atrasos')} para="/biblioteca/emprestimos?estado=atrasados" />
          <Numero cor="esg-w-cinza" icone="fa-bookmark" titulo={tx('RESERVAS')} valor={bib.reservas} extra={tx('Atender')} para="/biblioteca/emprestimos?estado=reservas" />
        </>}
        {seg && <>
          <Numero cor={seg.alerta.nivel === 'normal' ? 'esg-w-preto' : 'esg-w-vermelho'} icone="fa-shield-alt" titulo={tx('ESTADO DE SEGURANÇA')} valor={seg.alerta.motivos.length} extra={seg.alerta.nivel === 'normal' ? tx('Normal') : tx('Atenção')} para="/seguranca" />
          <Numero cor="esg-w-dourado" icone="fa-user-lock" titulo={tx('ENTRADAS FALHADAS HOJE')} valor={seg.dia?.login_falhado ?? 0} extra={tx('Centro de segurança')} para="/seguranca" />
          <Numero cor="esg-w-cinza" icone="fa-ban" titulo={tx('ENDEREÇOS BLOQUEADOS')} valor={seg.bloqueios.length} extra={tx('Centro de segurança')} para="/seguranca" />
        </>}
      </div>
      {verAc && <Atalhos pode={pode} />}
      {tarefas?.length > 0 && (
        <div className="panel panel-inverse">
          <div className="panel-heading"><h4 className="panel-title"><i className="fa fa-tasks me-2" />{tx('À sua espera')}</h4></div>
          <div className="list-group list-group-flush rounded-bottom">
            {tarefas.map((t) => <Tarefa key={t.para + t.texto} {...t} />)}
          </div>
        </div>
      )}
      {verAc && ano && <PorCurso ano={ano} />}
    </>
  )
}
