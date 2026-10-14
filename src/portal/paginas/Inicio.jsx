import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useSessao } from '../sessaoContexto'
import { Cartao, Carregando, Erro, Etiqueta, Titulo, Vazio, Widget } from '../componentes'
import { dataHora, faltam, maiusculaInicial, nota, primeiroNome } from '../formatar'
import { PERIODOS } from '../regraAvaliacao'
import { BarraProgresso } from '../cadeira/Progresso'

const saudacao = () => {
  const h = new Date().getHours()
  return h < 12 ? 'Bom dia' : h < 19 ? 'Boa tarde' : 'Boa noite'
}

// painel inicial (dashboard): números, aulas de hoje, prazos, avisos, notas e progresso no curso
function Inicio() {
  const { conta, eDocente } = useSessao()
  const [d, setD] = useState(null)
  const [percurso, setPercurso] = useState(null)
  const [progresso, setProgresso] = useState(null)
  const [erro, setErro] = useState('')
  const carregar = useCallback(() => {
    api('/inicio').then(setD).catch((e) => setErro(e.message))
    if (!eDocente) {
      api('/percurso').then(setPercurso).catch(() => {})
      api('/progresso').then(setProgresso).catch(() => {})
    }
  }, [eDocente])
  useEffect(() => { carregar() }, [carregar])

  const hoje = maiusculaInicial(new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' }))
  const anoAtual = percurso?.anos.at(-1)

  return (
    <>
      <Titulo rotulo="Painel" titulo={`${saudacao()}, ${primeiroNome(conta.nome)}`} sub={hoje} />
      {erro && <Erro texto={erro} onRepetir={() => { setErro(''); carregar() }} />}
      {!d && !erro ? <Carregando /> : d && (
        <>
          <div className="row">
            <div className="col-xl-3 col-md-6">
              <Widget cor="bg-dark" icone="fa-book" titulo={eDocente ? 'CADEIRAS QUE LECIONA' : 'CADEIRAS'} valor={d.cadeiras.length} nota="Ver cadeiras" para="/cadeiras" />
            </div>
            <div className="col-xl-3 col-md-6">
              <Widget cor="bg-red" icone="fa-chalkboard" titulo="AULAS HOJE" valor={d.aulasHoje.length} nota="Ver horário" para="/horario" />
            </div>
            <div className="col-xl-3 col-md-6">
              <Widget
                cor="bg-orange"
                icone="fa-tasks"
                titulo={eDocente ? 'PRAZOS A DECORRER' : 'TRABALHOS POR ENTREGAR'}
                valor={eDocente ? d.prazos.length : d.prazos.filter((p) => !p.entregue).length}
                nota="Ver calendário"
                para="/calendario"
              />
            </div>
            <div className="col-xl-3 col-md-6">
              {eDocente
                ? <Widget cor="bg-teal" icone="fa-bullhorn" titulo="AVISOS RECENTES" valor={d.avisos.length} nota="nas suas cadeiras" />
                : <Widget cor="bg-teal" icone="fa-graduation-cap" titulo="MÉDIA DAS APROVADAS" valor={percurso ? nota(percurso.resumo.media) : '—'} nota="Ver percurso académico" para="/percurso" />}
            </div>
          </div>

          <div className="row">
            <div className="col-xl-8">
              {!eDocente && anoAtual && <GraficoNotas ano={anoAtual} />}
              <Cartao titulo={<><i className="fa fa-chalkboard me-2" />Aulas de hoje</>}>
                {d.aulasHoje.length === 0 ? <Vazio>Sem aulas hoje.</Vazio> : (
                  <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                      <tbody>
                        {d.aulasHoje.map((a) => (
                          <tr key={a.id}>
                            <td className="fw-bold text-nowrap" style={{ width: 120 }}>{a.inicio}–{a.fim}</td>
                            <td><Link to={`/cadeiras/${a.cadeiraId}`} className="fw-bold text-decoration-none">{a.cadeira}</Link></td>
                            <td className="text-muted text-nowrap">{a.sala && <><i className="fa fa-map-marker-alt me-1" />{a.sala}</>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Cartao>
              <Cartao titulo={<><i className="fa fa-book me-2" />{eDocente ? 'As minhas cadeiras' : 'Cadeiras deste ano'}</>}>
                <ListaCadeiras cadeiras={d.cadeiras} progresso={progresso} />
              </Cartao>
            </div>

            <div className="col-xl-4">
              {!eDocente && percurso && <Progresso percurso={percurso} />}
              <Cartao titulo={<><i className="fa fa-hourglass-half me-2" />{eDocente ? 'Prazos dos trabalhos' : 'Próximos prazos'}</>} corpo={false}>
                {d.prazos.length === 0 ? <div className="panel-body"><Vazio>Sem trabalhos com prazo próximo.</Vazio></div> : (
                  <div className="list-group list-group-flush">
                    {d.prazos.map((p) => (
                      <Link key={p.id} to={`/cadeiras/${p.cadeiraId}?separador=trabalhos`} className="list-group-item list-group-item-action">
                        <div className="d-flex justify-content-between gap-2">
                          <span className="fw-bold">{p.titulo}</span>
                          {!eDocente && (p.entregue ? <Etiqueta cor="verde">Entregue</Etiqueta> : <Etiqueta cor="dourado">Por entregar</Etiqueta>)}
                        </div>
                        <div className="small text-muted">{p.cadeira}</div>
                        <div className="small"><i className="far fa-clock me-1" />{dataHora(p.prazo)} · {faltam(p.prazo)}</div>
                      </Link>
                    ))}
                  </div>
                )}
              </Cartao>
              {!eDocente && d.avisosGerais?.length > 0 && (
                <Cartao titulo={<><i className="fa fa-bullhorn me-2" />Administração Escolar</>} acoes={<Link to="/avisos" className="btn btn-xs btn-white">Ver todos</Link>} corpo={false}>
                  <div className="list-group list-group-flush">
                    {d.avisosGerais.map((a) => (
                      <div key={a.id} className="list-group-item">
                        <div className="fw-bold">{a.titulo}</div>
                        <div className="small p-recorte">{a.texto}</div>
                        <div className="small text-muted">{dataHora(a.criadoEm)}</div>
                      </div>
                    ))}
                  </div>
                </Cartao>
              )}
              <Cartao titulo={<><i className="fa fa-comment-alt me-2" />Avisos das cadeiras</>} corpo={false}>
                {d.avisos.length === 0 ? <div className="panel-body"><Vazio>Sem avisos.</Vazio></div> : (
                  <div className="list-group list-group-flush">
                    {d.avisos.map((a) => (
                      <Link key={a.id} to={`/cadeiras/${a.cadeiraId}?separador=avisos`} className="list-group-item list-group-item-action">
                        <div className="fw-bold">{a.titulo}</div>
                        <div className="small text-muted">{a.cadeira} · {dataHora(a.criadoEm)}</div>
                        <div className="small p-recorte">{a.texto}</div>
                      </Link>
                    ))}
                  </div>
                )}
              </Cartao>
            </div>
          </div>
        </>
      )}
    </>
  )
}

// gráfico de barras das disciplinas do ano: MAC e nota final (linha da aprovação nos 10 valores)
function GraficoNotas({ ano }) {
  const linhas = ano.disciplinas
  const L = 640
  const A = 200
  const y = (v) => A - (v / 20) * A
  const largura = Math.min(26, (L - 28) / Math.max(linhas.length, 1) / 3.2)
  return (
    <Cartao titulo={<><i className="fa fa-chart-bar me-2" />Notas de {ano.turma.anoLetivo}</>} acoes={<Link to="/notas" className="btn btn-xs btn-white">Boletim</Link>}>
      {linhas.every((l) => l.mac === null && l.final === null) ? <Vazio>Ainda não há notas publicadas este ano.</Vazio> : (
        <>
          <svg viewBox={`0 -10 ${L} ${A + 46}`} className="p-grafico" role="img" aria-label="MAC e nota final por disciplina">
            {[5, 10, 15, 20].map((v) => <line key={v} x1="28" x2={L} y1={y(v)} y2={y(v)} className={v === 10 ? 'p-grafico-minimo' : 'p-grafico-grelha'} />)}
            {[0, 10, 20].map((v) => <text key={v} x="0" y={y(v) + 4}>{v}</text>)}
            {linhas.map((l, i) => {
              const x = 28 + i * ((L - 28) / linhas.length) + ((L - 28) / linhas.length) / 2
              return (
                <g key={l.cadeira.id}>
                  {l.mac !== null && <rect x={x - largura - 2} y={y(l.mac)} width={largura} height={A - y(l.mac)} rx="2" fill="#c9a227"><title>MAC {nota(l.mac)}</title></rect>}
                  {l.final !== null && l.situacao !== 'recurso' && <rect x={x + 2} y={y(l.final)} width={largura} height={A - y(l.final)} rx="2" fill={l.final < 10 ? '#e53917' : '#1e7d4b'}><title>Nota final {l.final}</title></rect>}
                  <text x={x} y={A + 16} textAnchor="middle">{l.cadeira.codigo}</text>
                </g>
              )
            })}
          </svg>
          <div className="d-flex gap-3 small text-muted mt-1 flex-wrap">
            <span><i className="fa fa-square me-1" style={{ color: '#c9a227' }} />MAC</span>
            <span><i className="fa fa-square me-1" style={{ color: '#1e7d4b' }} />Nota final</span>
            <span><i className="fa fa-minus me-1 text-danger" />Aprovação (10)</span>
          </div>
        </>
      )}
    </Cartao>
  )
}

// progresso no curso: horas das disciplinas aprovadas sobre o total das inscritas
function Progresso({ percurso }) {
  const r = percurso.resumo
  const pct = r.horas ? Math.round((r.horasAprovadas / r.horas) * 100) : 0
  const raio = 54
  const volta = 2 * Math.PI * raio
  return (
    <Cartao titulo={<><i className="fa fa-route me-2" />Progresso no curso</>} acoes={<Link to="/percurso" className="btn btn-xs btn-white">Percurso</Link>}>
      <div className="d-flex align-items-center gap-3">
        <div className="p-anel">
          <svg viewBox="0 0 132 132" width="132" height="132" aria-hidden="true">
            <circle cx="66" cy="66" r={raio} fill="none" strokeWidth="12" className="p-anel-fundo" />
            <circle cx="66" cy="66" r={raio} fill="none" strokeWidth="12" stroke="#e53917" strokeLinecap="round" strokeDasharray={`${(pct / 100) * volta} ${volta}`} />
          </svg>
          <div className="p-anel-centro"><div><strong>{pct}%</strong><small>das horas</small></div></div>
        </div>
        <div className="flex-grow-1">
          <div className="d-flex justify-content-between small"><span>Disciplinas aprovadas</span><b>{r.aprovadas} / {r.disciplinas}</b></div>
          <div className="d-flex justify-content-between small"><span>Horas concluídas</span><b>{r.horasAprovadas} h</b></div>
          <div className="d-flex justify-content-between small"><span>Em curso</span><b>{r.emCurso}</b></div>
          <div className="d-flex justify-content-between small"><span>Reprovadas</span><b className={r.reprovadas ? 'text-danger' : ''}>{r.reprovadas}</b></div>
        </div>
      </div>
    </Cartao>
  )
}

export function ListaCadeiras({ cadeiras, progresso }) {
  if (!cadeiras.length) return <Vazio>Ainda não tem cadeiras. Contacte a Administração Escolar.</Vazio>
  return (
    <div className="p-grelha-cadeiras">
      {cadeiras.map((c) => (
        <Link key={c.id} to={`/cadeiras/${c.id}`} className="p-cadeira">
          <span className="p-cadeira-topo">
            <span className="p-cadeira-icone"><i className="fa fa-book" /></span>
            <span className="p-cadeira-codigo">{c.codigo} · {PERIODOS[c.periodo]}</span>
          </span>
          <strong>{c.nome}</strong>
          <span className="small text-muted">
            {c.docente ? <><i className="fa fa-star text-warning me-1" />{c.docente.nome}</> : 'Docentes por alocar'}
            {c.docentes?.length > 1 && ` + ${c.docentes.length - 1}`}
          </span>
          {c.turma && <small className="text-muted">{c.turma.nome}</small>}
          {progresso?.[c.id]?.total > 0 && <div className="mt-2"><BarraProgresso p={progresso[c.id]} /></div>}
        </Link>
      ))}
    </div>
  )
}

export default Inicio
