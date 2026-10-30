import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useSessao } from '../sessaoContexto'
import { t as tx, localAtual } from '../../i18n/linguas'

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

export default function PainelPapel() {
  const { pode } = useSessao()
  const [ac, setAc] = useState(null)
  const [bib, setBib] = useState(null)
  const [seg, setSeg] = useState(null)
  const [contas, setContas] = useState(null)
  const [porAprovar, setPorAprovar] = useState(null)
  const verAc = pode('academico.ver')
  const verBib = pode('biblioteca.ver')
  const verSeg = pode('seguranca.ver')
  const verPes = pode('pessoal.ver')
  const aprova = pode('publicacoes.aprovar')
  useEffect(() => {
    if (verAc) api('/academico/pendentes').then(setAc).catch(() => {})
    if (verBib) api('/biblioteca').then(setBib).catch(() => {})
    if (verSeg) api('/seguranca').then(setSeg).catch(() => {})
    if (verPes) api('/academico/contas').then(setContas).catch(() => {})
    if (aprova) api('/publicacoes/contagem').then((r) => setPorAprovar(r.pendentes)).catch(() => {})
  }, [verAc, verBib, verSeg, verPes, aprova])

  const homologa = pode('academico.homologar')
  const conselho = pode('academico.conselho')
  const gere = pode('academico.gerir')
  const tarefas = (ac || porAprovar !== null) && [
    aprova && { para: '/publicacoes', icone: 'fa-stamp', cor: 'bg-danger', texto: tx('Publicações do site por aprovar'), valor: porAprovar ?? 0 },
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
          <Numero cor="esg-w-vermelho" icone="fa-users" titulo={tx('TURMAS ATIVAS')} valor={ac.turmas} extra={tx('Turmas e matrículas')} para="/academico/turmas" />
          <Numero cor="esg-w-preto" icone="fa-user-graduate" titulo={tx('ESTUDANTES MATRICULADOS')} valor={ac.estudantes} extra={tx('Indicadores')} para="/academico/indicadores" />
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
      {tarefas?.length > 0 && (
        <div className="panel panel-inverse">
          <div className="panel-heading"><h4 className="panel-title"><i className="fa fa-tasks me-2" />{tx('À sua espera')}</h4></div>
          <div className="list-group list-group-flush rounded-bottom">
            {tarefas.map((t) => <Tarefa key={t.para + t.texto} {...t} />)}
          </div>
        </div>
      )}
    </>
  )
}
