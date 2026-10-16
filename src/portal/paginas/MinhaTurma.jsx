import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useSessao } from '../sessaoContexto'
import { Cartao, Carregando, Erro, Vazio } from '../componentes'
import { capaCadeira, dataHora, faltam, iniciais, maiusculaInicial, primeiroNome } from '../formatar'
import { lerContinuar } from '../recentes'
import CartaoTelemovel from '../CartaoTelemovel'
import { PERIODOS } from '../regraAvaliacao'
import { t as tx, localAtual } from '../../i18n/linguas'

const saudacao = () => {
  const h = new Date().getHours()
  return h < 12 ? tx('Bom dia') : h < 19 ? tx('Boa tarde') : tx('Boa noite')
}

/*
  Página de entrada do estudante: a sua turma. Em cima a turma e os colegas; depois
  "continuar onde parou" e as cadeiras da turma, cada uma com a sua sala de aula;
  ao lado, o dia de hoje, o que há para fazer e os avisos.
*/
function MinhaTurma() {
  const { conta } = useSessao()
  const [d, setD] = useState(null)
  const [progresso, setProgresso] = useState(null)
  const [colegas, setColegas] = useState(null)
  const [erro, setErro] = useState('')
  const matricula = conta.matriculas?.find((m) => m.estado === 'ativa') || conta.matriculas?.[0]
  const turma = matricula?.turma
  const continuar = lerContinuar(conta.id)

  const carregar = useCallback(() => {
    api('/inicio').then((r) => {
      setD(r)
      // os colegas são os estudantes de uma cadeira da turma
      const daTurma = r.cadeiras.find((c) => c.turmaId === turma?.id) || r.cadeiras[0]
      if (daTurma) api(`/cadeiras/${daTurma.id}/participantes`).then((p) => setColegas(p.estudantes.filter((e) => e.id !== conta.id))).catch(() => setColegas([]))
    }).catch((e) => setErro(e.message))
    api('/progresso').then(setProgresso).catch(() => {})
  }, [turma?.id, conta.id])
  useEffect(() => { carregar() }, [carregar])

  if (erro) return <Erro texto={erro} onRepetir={() => { setErro(''); carregar() }} />
  if (!d) return <Carregando />

  const daTurma = d.cadeiras.filter((c) => !turma || c.turmaId === turma.id)
  const outras = d.cadeiras.filter((c) => turma && c.turmaId !== turma.id)
  const porFazer = d.prazos.filter((p) => !p.entregue).sort((a, b) => a.prazo.localeCompare(b.prazo)).slice(0, 5)
  const hoje = maiusculaInicial(new Date().toLocaleDateString(localAtual(), { weekday: 'long', day: 'numeric', month: 'long' }))

  return (
    <>
      <section className="p-turma-topo">
        <div className="p-turma-topo-texto">
          <span className="p-turma-rotulo"><i className="fa fa-users me-2" />{tx('A minha turma')}</span>
          <h1>{turma?.nome || tx('Sem turma')}</h1>
          <p>
            {saudacao()}, {primeiroNome(conta.nome)}. {turma && tx('Ano letivo {0}', { 0: turma.anoLetivo })}
            {' · '}{tx('{0} cadeira(s)', { 0: daTurma.length })}
            {colegas && ` · ${tx('{0} colega(s)', { 0: colegas.length })}`}
          </p>
        </div>
        {colegas?.length > 0 && (
          <div className="p-turma-colegas" aria-label={tx('Colegas de turma')}>
            {colegas.slice(0, 8).map((e) => <span key={e.id} className="p-turma-avatar" title={e.nome}>{iniciais(e.nome)}</span>)}
            {colegas.length > 8 && <span className="p-turma-avatar mais">+{colegas.length - 8}</span>}
          </div>
        )}
      </section>

      <CartaoTelemovel />

      {continuar && d.cadeiras.some((c) => c.id === continuar.cadeiraId) && (
        <Link to={`/cadeiras/${continuar.cadeiraId}?atividade=${continuar.chave}`} className="p-turma-continuar">
          <span className="p-turma-continuar-icone"><i className="fa fa-play" /></span>
          <span className="flex-grow-1 min-w-0">
            <span className="d-block small text-muted">{tx('Continuar onde parou')} · {continuar.cadeira}</span>
            <span className="d-block fw-bold text-truncate">{continuar.titulo}</span>
          </span>
          <span className="btn btn-theme btn-sm">{tx('Continuar')} <i className="fa fa-arrow-right ms-1" /></span>
        </Link>
      )}

      <div className="row">
        <div className="col-xl-8">
          <h2 className="h5 mb-3">{tx('As cadeiras da turma')}</h2>
          {daTurma.length === 0 && <Vazio>{tx('Ainda não tem cadeiras. Contacte a Administração Escolar.')}</Vazio>}
          <div className="row g-3 mb-4">
            {daTurma.map((c) => <CartaoCadeira key={c.id} c={c} p={progresso?.[c.id]} />)}
          </div>
          {outras.length > 0 && (
            <>
              <h2 className="h6 text-muted mb-3">{tx('Outras cadeiras (por inscrição)')}</h2>
              <div className="row g-3 mb-4">{outras.map((c) => <CartaoCadeira key={c.id} c={c} p={progresso?.[c.id]} />)}</div>
            </>
          )}
        </div>

        <div className="col-xl-4">
          <Cartao titulo={<><i className="fa fa-sun me-2" />{tx('Hoje')} · {hoje}</>} corpo={false}>
            {d.aulasHoje.length === 0 ? <div className="panel-body"><Vazio>{tx('Sem aulas hoje.')}</Vazio></div> : (
              <div className="list-group list-group-flush">
                {d.aulasHoje.map((a) => (
                  <Link key={a.id} to={`/cadeiras/${a.cadeiraId}`} className="list-group-item list-group-item-action d-flex gap-3 align-items-center">
                    <span className="p-hora">{a.inicio}</span>
                    <span className="flex-grow-1 min-w-0"><span className="d-block fw-bold text-truncate">{a.cadeira}</span><span className="small text-muted">{a.inicio}–{a.fim}{a.sala && ` · ${a.sala}`}</span></span>
                  </Link>
                ))}
              </div>
            )}
          </Cartao>

          <Cartao titulo={<><i className="fa fa-tasks me-2" />{tx('Para fazer')}</>} acoes={<Link to="/calendario" className="btn btn-xs btn-white">{tx('Calendário')}</Link>} corpo={false}>
            {porFazer.length === 0 ? <div className="panel-body"><Vazio>{tx('Não tem trabalhos por entregar.')}</Vazio></div> : (
              <div className="list-group list-group-flush">
                {porFazer.map((p) => (
                  <Link key={p.id} to={`/cadeiras/${p.cadeiraId}?atividade=trabalho-${p.id}`} className="list-group-item list-group-item-action">
                    <div className="d-flex justify-content-between gap-2"><span className="fw-bold">{p.titulo}</span><span className="badge bg-warning text-dark text-nowrap align-self-start">{faltam(p.prazo)}</span></div>
                    <div className="small text-muted">{p.cadeira} · {tx('até {0}', { 0: dataHora(p.prazo) })}</div>
                  </Link>
                ))}
              </div>
            )}
          </Cartao>

          <Cartao titulo={<><i className="fa fa-bullhorn me-2" />{tx('Avisos')}</>} acoes={<Link to="/avisos" className="btn btn-xs btn-white">{tx('Ver todos')}</Link>} corpo={false}>
            {d.avisos.length + (d.avisosGerais?.length || 0) === 0 ? <div className="panel-body"><Vazio>{tx('Sem avisos.')}</Vazio></div> : (
              <div className="list-group list-group-flush">
                {(d.avisosGerais || []).slice(0, 2).map((a) => (
                  <Link key={`g${a.id}`} to="/avisos" className="list-group-item list-group-item-action">
                    <div className="small text-muted text-uppercase fw-bold">{tx('Administração Escolar')}</div>
                    <div className="fw-bold">{a.titulo}</div>
                    <div className="small p-recorte">{a.texto}</div>
                  </Link>
                ))}
                {d.avisos.slice(0, 4).map((a) => (
                  <Link key={a.id} to={`/cadeiras/${a.cadeiraId}?separador=avisos`} className="list-group-item list-group-item-action">
                    <div className="small text-muted text-uppercase fw-bold">{a.cadeira}</div>
                    <div className="fw-bold">{a.titulo}</div>
                    <div className="small text-muted">{dataHora(a.criadoEm)}</div>
                  </Link>
                ))}
              </div>
            )}
          </Cartao>
        </div>
      </div>
    </>
  )
}

// cartão de uma cadeira: capa com a cor da cadeira, docente, progresso e a entrada na sala
function CartaoCadeira({ c, p }) {
  const [a, b] = capaCadeira(c.codigo)
  return (
    <div className="col-md-6">
      <Link to={`/cadeiras/${c.id}`} className="p-turma-cadeira">
        <span className="p-turma-cadeira-capa" style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}>
          <span className="p-capa-codigo">{c.codigo}</span>
          <i className="fa fa-chalkboard p-capa-icone" />
        </span>
        <span className="p-turma-cadeira-corpo">
          <span className="small text-muted text-uppercase fw-bold">{PERIODOS[c.periodo]} · {c.horas} {tx('h')}</span>
          <span className="d-block h6 mt-1 mb-1 text-body">{c.nome}</span>
          <span className="d-block small text-muted"><i className="fa fa-chalkboard-teacher me-1" />{c.docente ? c.docente.nome : tx('Docentes por alocar')}</span>
          {p?.total > 0 && (
            <span className="d-flex align-items-center gap-2 small mt-2">
              <span className="progress flex-grow-1" style={{ height: 6 }}><span className="progress-bar bg-success" style={{ width: `${p.percentagem}%` }} /></span>
              <span className="text-muted text-nowrap">{tx('{0} de {1}', { 0: p.feitas, 1: p.total })}</span>
            </span>
          )}
          <span className="btn btn-theme btn-sm mt-3 align-self-start"><i className="fa fa-door-open me-1" />{tx('Entrar na sala de aula')}</span>
        </span>
      </Link>
    </div>
  )
}

export default MinhaTurma
