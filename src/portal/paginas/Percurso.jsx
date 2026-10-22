import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useSessao } from '../sessaoContexto'
import { Cartao, Carregando, Erro, Titulo, Vazio, Widget } from '../componentes'
import { nota } from '../formatar'
import { Nota, Situacao } from '../avaliacao'
import { PERIODOS, REGRA } from '../regraAvaliacao'
import { t as tx, localAtual } from '../../i18n/linguas'
import CabecalhoImpressao from '../../components/CabecalhoImpressao'
import RegrasPlano from '../RegrasPlano'

const ESTADOS = { ativa: ['bg-primary', tx('Em curso')], concluida: ['bg-success', tx('Concluído')], suspensa: ['bg-warning text-dark', tx('Suspenso')] }

/*
  Percurso académico: os anos do estudante na Escola, do primeiro ao atual (linha do tempo),
  com as disciplinas de cada ano, as notas finais publicadas e um resumo do curso.
*/
function Percurso() {
  const { conta } = useSessao()
  const [p, setP] = useState(null)
  const [erro, setErro] = useState('')
  useEffect(() => { api('/percurso').then(setP).catch((e) => setErro(e.message)) }, [])

  if (erro) return <Erro texto={erro} />
  if (!p) return <Carregando />
  const r = p.resumo
  const pct = r.horas ? Math.round((r.horasAprovadas / r.horas) * 100) : 0

  return (
    <>
      <CabecalhoImpressao titulo="Percurso académico" subtitulo={`${conta.nome} · n.º ${conta.numero}`} area="Administração Escolar" />
      <Titulo rotulo={tx('Percurso académico')} titulo={tx('Percurso académico')} sub={`${conta.nome} · n.º ${conta.numero}`}>
        <button type="button" className="btn btn-white" onClick={() => window.print()}><i className="fa fa-print me-1" /> {tx('Imprimir')}</button>
      </Titulo>

      <div className="row">
        <div className="col-xl-3 col-md-6"><Widget cor="bg-dark" icone="fa-layer-group" titulo={tx('ANOS FREQUENTADOS')} valor={p.anos.length} nota={p.anos.map((a) => a.turma.anoLetivo).join(' · ') || '—'} /></div>
        <div className="col-xl-3 col-md-6"><Widget cor="bg-teal" icone="fa-check-double" titulo={tx('DISCIPLINAS APROVADAS')} valor={`${r.aprovadas} / ${r.disciplinas}`} nota={tx('{0} reprovada(s) · {1} em curso', { 0: r.reprovadas, 1: r.emCurso })} /></div>
        <div className="col-xl-3 col-md-6"><Widget cor="bg-red" icone="fa-star" titulo={tx('MÉDIA DAS APROVADAS')} valor={nota(r.media)} nota={tx('média aritmética das notas finais')} /></div>
        <div className="col-xl-3 col-md-6">
          <div className="widget widget-stats bg-orange">
            <div className="stats-icon"><i className="fa fa-hourglass-half" /></div>
            <div className="stats-info"><h4>{tx('HORAS CONCLUÍDAS')}</h4><p>{r.horasAprovadas} {tx('h')}</p></div>
            <div className="stats-progress progress"><div className="progress-bar" style={{ width: `${pct}%` }} /></div>
            <div className="stats-desc">{pct}{tx('% das')} {r.horas} {tx('h das disciplinas inscritas')}</div>
          </div>
        </div>
      </div>

      {p.planoCurso && <PlanoCurso pc={p.planoCurso} conclusao={p.conclusao} />}

      {p.anos.length === 0 ? <Vazio>{tx('Ainda não tem matrículas.')}</Vazio> : (
        <div className="timeline p-percurso">
          {[...p.anos].reverse().map((a) => {
            const [cor, estado] = ESTADOS[a.matricula.estado] || ESTADOS.ativa
            return (
              <div key={a.matricula.id} className={`timeline-item ${a.matricula.estado === 'concluida' ? 'p-concluido' : ''}`}>
                <div className="timeline-time">
                  <span className="date">{a.turma.anoLetivo}</span>
                  <span className="time">{a.turma.anoCurricular}{tx('.º ano')}</span>
                </div>
                <div className="timeline-icon"><a href="#percurso" onClick={(e) => e.preventDefault()} aria-hidden="true" tabIndex={-1}>&nbsp;</a></div>
                <div className="timeline-content">
                  <div className="timeline-header">
                    <div className="username">
                      <span className="fw-bold">{a.turma.nome}</span> <span className={`badge ${cor} ms-1`}>{estado}</span>
                      <div className="text-muted fs-12px">{a.resumo.aprovadas} {tx('de')} {a.resumo.disciplinas} {tx('disciplinas aprovadas ·')} {a.resumo.horasAprovadas} / {a.resumo.horas} {tx('h')}</div>
                    </div>
                    <div className="text-end">
                      <div className="text-muted fs-11px text-uppercase">{tx('Média do ano')}</div>
                      <div className="fs-20px fw-bold">{nota(a.resumo.media)}</div>
                    </div>
                  </div>
                  <div className="timeline-body">
                    <div className="table-responsive">
                      <table className="table table-bordered table-hover align-middle text-center mb-0 p-matriz">
                        <thead>
                          <tr>
                            <th scope="col" className="p-matriz-nome">{tx('Disciplina')}</th>
                            <th scope="col">{tx('Horas')}</th>
                            <th scope="col" className="p-matriz-mac">{tx('MAC')}</th>
                            <th scope="col">{tx('Exame')}</th>
                            <th scope="col">{tx('Recurso')}</th>
                            <th scope="col" className="p-matriz-final">{tx('Nota final')}</th>
                            <th scope="col">{tx('Situação')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {a.disciplinas.length === 0 && <tr><td colSpan={7} className="text-muted">{tx('Sem disciplinas.')}</td></tr>}
                          {a.disciplinas.map((l) => (
                            <tr key={l.cadeira.id}>
                              <th scope="row" className="p-matriz-nome">
                                {a.matricula.estado === 'ativa' ? <Link to={`/cadeiras/${l.cadeira.id}`}>{l.cadeira.nome}</Link> : l.cadeira.nome}
                                <small>{l.cadeira.codigo} · {PERIODOS[l.cadeira.periodo]}{l.cadeira.docente && ` · ${l.cadeira.docente}`}</small>
                              </th>
                              <td>{l.cadeira.horas}</td>
                              <td className="p-matriz-mac"><Nota valor={l.mac} /></td>
                              <td>{l.situacao === 'dispensado' ? <span className="p-nota-vazia">{tx('dispensado')}</span> : <Nota valor={l.exame} />}</td>
                              <td><Nota valor={l.recurso} /></td>
                              <td className="p-matriz-final"><Nota valor={l.situacao === 'recurso' ? null : l.final} forte /></td>
                              <td><Situacao situacao={l.situacao} />{l.classificacao && l.situacao !== 'reprovado' && <small className="p-classificacao">{l.classificacao}</small>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  {a.resumo.reprovadas > 0 && (
                    <div className="timeline-footer text-danger small">
                      <i className="fa fa-exclamation-triangle me-1" />{a.resumo.reprovadas} {tx('disciplina(s) em atraso: fale com a Administração Escolar sobre a inscrição.')}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
      {p.inscricoes?.length > 0 && (
        <Cartao titulo={<><i className="fa fa-user-plus me-2" />{tx('Cadeiras por inscrição (fora da turma)')}</>} corpo={false}>
          <div className="table-responsive">
            <table className="table table-striped align-middle mb-0">
              <thead><tr><th>{tx('Cadeira')}</th><th>{tx('Turma')}</th><th className="text-center">{tx('Nota final')}</th><th>{tx('Situação')}</th></tr></thead>
              <tbody>{p.inscricoes.map((d) => <tr key={d.cadeira.id}><td><Link to={`/cadeiras/${d.cadeira.id}`}><b>{d.cadeira.codigo}</b> {d.cadeira.nome}</Link></td><td className="small">{d.cadeira.turma} · {d.cadeira.anoLetivo}</td><td className="text-center"><Nota valor={d.final} /></td><td><Situacao situacao={d.situacao} /></td></tr>)}</tbody>
            </table>
          </div>
        </Cartao>
      )}
      {(p.tfc || p.conclusao?.concluido) && (
        <Cartao titulo={<><i className="fa fa-graduation-cap me-2" />{tx('Conclusão do curso')}</>}>
          {p.tfc && (
            <div className="mb-2">
              <div className="small text-muted">{p.planoCurso?.trabalho ? `${p.planoCurso.trabalho.sigla} — ${tx(p.planoCurso.trabalho.nome)}` : tx('Trabalho de fim de curso')}</div>
              <b>{p.tfc.tema}</b>
              <div className="small">{p.tfc.orientador && `Orientador: ${p.tfc.orientador} · `}{p.tfc.nota !== null ? tx('Nota: {0} valores ({1})', { 0: nota(p.tfc.nota), 1: p.tfc.classificacao }) : tx('Por defender')}</div>
            </div>
          )}
          {p.conclusao?.concluido
            ? <div className="alert alert-success mb-0"><i className="fa fa-award me-1" />{tx('Curso concluído com')} <b>{nota(p.conclusao.mediaFinal)} {tx('valores')}</b> ({p.conclusao.classificacaoFinal}).{p.certificado && <> {tx('Certificado emitido em')} {new Date(p.certificado.emitidoEm).toLocaleDateString(localAtual())} {tx('— código')} <span className="font-monospace">{p.certificado.codigo}</span>.</>}</div>
            : p.conclusao?.emFalta?.length > 0 && <div className="small text-muted">{tx('Falta para concluir:')} {p.conclusao.emFalta.join('; ')}.</div>}
        </Cartao>
      )}
      <p className="p-legenda">{REGRA} {tx('Só contam as notas já publicadas.')}</p>
    </>
  )
}

// a classificação pelo plano de curso da ESG: os blocos, a média ponderada, a nota final e a menção
function PlanoCurso({ pc, conclusao }) {
  const formula = { ponderada: tx('média dos blocos ponderada pelos coeficientes'), percentagem: tx('média dos blocos com pesos em percentagem'), media: tx('média aritmética simples das unidades curriculares') }[pc.formula]
  return (
    <div className="card mb-3">
      <div className="card-header fw-bold"><i className="fa fa-clipboard-list me-2" />{pc.nome}</div>
      <div className="card-body">
        {pc.blocos.length > 0 && (
          <div className="table-responsive">
            <table className="table table-sm align-middle mb-3">
              <thead><tr><th>{tx('Bloco')}</th><th className="text-center">{tx('UC')}</th><th className="text-center">{tx('Coeficiente')}</th><th className="text-center">{tx('Nota do bloco')}</th></tr></thead>
              <tbody>{pc.blocos.map((b) => (
                <tr key={b.sigla}><td><b>{b.sigla}</b> — {b.nome}</td><td className="text-center">{b.ucs}</td><td className="text-center">{String(b.coeficiente).replace('.', ',')}</td><td className="text-center"><Nota valor={b.nota} />{b.nota !== null && !b.aprovado && <small className="d-block text-danger">{tx('abaixo de 10')}</small>}</td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
        <div className="d-flex flex-wrap gap-4 align-items-end">
          <div><div className="text-muted small">{tx('Média')} ({formula})</div><div className="fs-20px fw-bold"><Nota valor={pc.media} /></div></div>
          {pc.ajuste ? <div><div className="text-muted small">{tx('Ajuste do Comandante')}</div><div className="fs-20px fw-bold">{pc.ajuste > 0 ? '+' : ''}{String(pc.ajuste).replace('.', ',')}</div></div> : null}
          <div><div className="text-muted small">{tx('Nota final')}</div><div className="fs-20px fw-bold"><Nota valor={pc.final} forte /></div></div>
          <div><div className="text-muted small">{tx('Menção')}</div><div className="fs-20px fw-bold">{pc.mencao || '—'}{pc.distinto && <span className="badge bg-warning text-dark ms-2"><i className="fa fa-medal me-1" />{tx('DISTINTO')}</span>}</div></div>
          <div className="ms-auto">{pc.homologado ? <span className="badge bg-success"><i className="fa fa-stamp me-1" />{tx('Homologada pelo Comandante')}</span> : <span className="badge bg-secondary">{tx('Classificação provisória (por homologar)')}</span>}</div>
        </div>
        {!conclusao.concluido && conclusao.emFalta?.length > 0 && <div className="small text-muted mt-3"><b>{tx('Para concluir o curso:')}</b> {conclusao.emFalta.join(' · ')}</div>}
        {pc.regras && <RegrasPlano plano={pc.regras} />}
      </div>
    </div>
  )
}

export default Percurso
