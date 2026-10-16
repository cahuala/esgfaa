import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useSessao } from '../sessaoContexto'
import { Cartao, Carregando, Erro, Titulo, Vazio, Widget } from '../componentes'
import { dataHora, maiusculaInicial, nota, primeiroNome, tituloAgenda } from '../formatar'
import { lerRecentes } from '../recentes'
import VisaoCadeiras from '../VisaoCadeiras'
import CartaoTelemovel from '../CartaoTelemovel'
import { t as tx, localAtual } from '../../i18n/linguas'

// iniciais dos dias, de segunda a domingo, na língua escolhida (5 de janeiro de 2026 foi segunda-feira)
const INICIAIS_SEMANA = () => [5, 6, 7, 8, 9, 10, 11].map((d) => new Intl.DateTimeFormat(localAtual(), { weekday: 'narrow' }).format(new Date(2026, 0, d)).toUpperCase())

const saudacao = () => {
  const h = new Date().getHours()
  return h < 12 ? tx('Bom dia') : h < 19 ? tx('Boa tarde') : tx('Boa noite')
}
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const ICONES = {
  prazo: ['fa-file-signature', 'bg-orange', tx('Entregar')], questionario: ['fa-question', 'bg-purple', tx('Responder')],
  p1: ['fa-pen', 'bg-yellow text-dark', tx('Ver')], p2: ['fa-pen', 'bg-yellow text-dark', tx('Ver')], exame: ['fa-graduation-cap', 'bg-red', tx('Ver')],
  recurso: ['fa-redo', 'bg-dark', tx('Ver')], geral: ['fa-flag', 'bg-blue', tx('Ver')], feriado: ['fa-umbrella-beach', 'bg-teal', tx('Ver')],
}

/*
  Painel do portal (como o "Dashboard" do Moodle): números, linha temporal das próximas atividades,
  cadeiras acedidas recentemente, visão das cadeiras com progresso; à direita o mini-calendário,
  o progresso no curso, as aulas de hoje e os avisos.
*/
function Inicio() {
  const { conta, eDocente } = useSessao()
  const [d, setD] = useState(null)
  const [percurso, setPercurso] = useState(null)
  const [progresso, setProgresso] = useState(null)
  const [agenda, setAgenda] = useState(null)
  const [mes, setMes] = useState([])
  const [dias, setDias] = useState(30)
  const [erro, setErro] = useState('')
  const hoje = useMemo(() => new Date(), [])

  const carregar = useCallback(() => {
    api('/inicio').then(setD).catch((e) => setErro(e.message))
    if (!eDocente) {
      api('/percurso').then(setPercurso).catch(() => {})
      api('/progresso').then(setProgresso).catch(() => {})
    }
  }, [eDocente])
  useEffect(() => { carregar() }, [carregar])
  // próximas seis semanas (linha temporal) e o mês corrente (mini-calendário)
  useEffect(() => {
    const ate = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 44)
    api(`/calendario?de=${iso(hoje)}&ate=${iso(ate)}`).then(setAgenda).catch(() => setAgenda([]))
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
    const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)
    api(`/calendario?de=${iso(inicioMes)}&ate=${iso(fimMes)}`).then(setMes).catch(() => {})
  }, [hoje])

  const recentes = d ? lerRecentes(conta.id).map((id) => d.cadeiras.find((c) => c.id === id)).filter(Boolean).slice(0, 3) : []
  const anoAtual = percurso?.anos.at(-1)
  const limite = iso(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + dias))
  const linha = (agenda || [])
    .map((i) => (i.momento ? { ...i, data: iso(new Date(i.momento)), inicio: new Date(i.momento).toLocaleTimeString(localAtual(), { hour: '2-digit', minute: '2-digit' }) } : i))
    .filter((i) => i.tipo !== 'aula' && i.data >= iso(hoje) && i.data <= limite)
  const porDia = linha.reduce((m, i) => ((m[i.data] ||= []).push(i), m), {})
  const porEntregar = d ? d.prazos.filter((p) => !p.entregue).length : 0

  return (
    <>
      <Titulo rotulo={tx('Painel')} titulo={`${saudacao()}, ${primeiroNome(conta.nome)}`} sub={maiusculaInicial(hoje.toLocaleDateString(localAtual(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}>
        <Link to="/calendario" className="btn btn-white"><i className="fa fa-calendar-alt me-1" /> {tx('Calendário')}</Link>
        {!eDocente && <Link to="/notas" className="btn btn-theme"><i className="fa fa-clipboard-list me-1" /> {tx('As minhas notas')}</Link>}
      </Titulo>
      <CartaoTelemovel />
      {erro && <Erro texto={erro} onRepetir={() => { setErro(''); carregar() }} />}
      {!d && !erro ? <Carregando /> : d && (
        <>
          <div className="row">
            <div className="col-xl-3 col-md-6"><Widget cor="bg-dark" icone="fa-book" titulo={eDocente ? tx('CADEIRAS QUE LECIONA') : tx('CADEIRAS EM CURSO')} valor={d.cadeiras.length} nota={tx('Ver as cadeiras')} para="/cadeiras" /></div>
            <div className="col-xl-3 col-md-6"><Widget cor="bg-red" icone="fa-chalkboard" titulo={tx('AULAS HOJE')} valor={d.aulasHoje.length} nota={tx('Ver horário')} para="/horario" /></div>
            <div className="col-xl-3 col-md-6"><Widget cor="bg-orange" icone="fa-hourglass-half" titulo={eDocente ? tx('ENTREGAS A DECORRER') : tx('TRABALHOS POR ENTREGAR')} valor={eDocente ? d.prazos.length : porEntregar} nota={tx('Ver calendário')} para="/calendario" /></div>
            <div className="col-xl-3 col-md-6">
              {eDocente
                ? <Widget cor="bg-teal" icone="fa-calendar-check" titulo={tx('DATAS PRÓXIMAS')} valor={linha.length} nota={tx('provas, exames e entregas')} />
                : <Widget cor="bg-teal" icone="fa-graduation-cap" titulo={tx('MÉDIA DAS APROVADAS')} valor={percurso ? nota(percurso.resumo.media) : '—'} nota={tx('Ver percurso académico')} para="/percurso" />}
            </div>
          </div>

          <div className="row">
            <div className="col-xl-8">
              <Cartao
                titulo={<><i className="fa fa-stream me-2" />{tx('Linha temporal')}</>}
                acoes={(
                  <select className="form-select form-select-sm p-select-escuro" value={dias} onChange={(e) => setDias(Number(e.target.value))} aria-label={tx('Período da linha temporal')}>
                    <option value={7}>{tx('Próximos 7 dias')}</option>
                    <option value={30}>{tx('Próximos 30 dias')}</option>
                    <option value={44}>{tx('Próximas 6 semanas')}</option>
                  </select>
                )}
                corpo={false}
              >
                {!agenda ? <div className="panel-body"><Carregando /></div> : linha.length === 0 ? (
                  <div className="panel-body text-center text-muted py-4"><i className="fa fa-mug-hot fa-2x d-block mb-2 opacity-50" />{tx('Nada para fazer nos próximos')} {dias} {tx('dias.')}</div>
                ) : (
                  <div className="list-group list-group-flush">
                    {Object.entries(porDia).map(([dia, itens]) => (
                      <div key={dia}>
                        <div className="list-group-item p-dia-titulo">{maiusculaInicial(new Date(`${dia}T12:00:00`).toLocaleDateString(localAtual(), { weekday: 'long', day: 'numeric', month: 'long' }))}</div>
                        {itens.map((i) => {
                          const [icone, cor, acao] = ICONES[i.tipo] || ICONES.geral
                          const destino = i.tipo === 'prazo' ? `/cadeiras/${i.cadeiraId}?atividade=trabalho-${i.id.slice(1)}`
                            : i.tipo === 'questionario' ? `/cadeiras/${i.cadeiraId}?atividade=questionario-${i.id.slice(1)}`
                              : i.cadeiraId ? `/cadeiras/${i.cadeiraId}?separador=horario` : '/calendario'
                          return (
                            <div key={i.id} className="list-group-item d-flex align-items-center gap-3">
                              <span className="small text-muted text-nowrap" style={{ width: 44 }}>{i.inicio || '—'}</span>
                              <span className={`p-atividade-icone ${cor}`} style={{ width: 34, height: 34, fontSize: 14 }}><i className={`fa ${icone}`} /></span>
                              <div className="flex-grow-1 min-w-0">
                                <div className="fw-bold text-truncate">{tituloAgenda(i.titulo)}</div>
                                <div className="small text-muted text-truncate">{i.cadeira || i.turma || tx('Escola Superior de Guerra')}{i.local && ` · ${i.local}`}</div>
                              </div>
                              <Link to={destino} className="btn btn-sm btn-white text-nowrap">{eDocente ? tx('Ver') : acao}</Link>
                            </div>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </Cartao>

              {recentes.length > 0 && (
                <Cartao titulo={<><i className="fa fa-history me-2" />{tx('Acedidas recentemente')}</>}>
                  <VisaoCadeiras cadeiras={recentes} progresso={progresso} compacto />
                </Cartao>
              )}

              <Cartao titulo={<><i className="fa fa-book me-2" />{tx('As minhas cadeiras')}</>} acoes={<Link to="/cadeiras" className="btn btn-xs btn-white">{tx('Ver todas')}</Link>}>
                <VisaoCadeiras cadeiras={d.cadeiras} progresso={progresso} compacto />
              </Cartao>

              {!eDocente && anoAtual && <GraficoNotas ano={anoAtual} />}
            </div>

            <div className="col-xl-4">
              <MiniCalendario hoje={hoje} itens={mes} />
              {!eDocente && percurso && <Progresso percurso={percurso} />}
              <Cartao titulo={<><i className="fa fa-chalkboard me-2" />{tx('Aulas de hoje')}</>} corpo={false}>
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
              {!eDocente && d.avisosGerais?.length > 0 && (
                <Cartao titulo={<><i className="fa fa-bullhorn me-2" />{tx('Administração Escolar')}</>} acoes={<Link to="/avisos" className="btn btn-xs btn-white">{tx('Ver todos')}</Link>} corpo={false}>
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
              <Cartao titulo={<><i className="fa fa-comment-alt me-2" />{tx('Avisos das cadeiras')}</>} corpo={false}>
                {d.avisos.length === 0 ? <div className="panel-body"><Vazio>{tx('Sem avisos.')}</Vazio></div> : (
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

// mini-calendário do mês com pontos nos dias com datas (como o bloco "Calendário" do Moodle)
function MiniCalendario({ hoje, itens }) {
  const navegar = useNavigate()
  const primeiro = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1 - ((primeiro.getDay() + 6) % 7))
  const dias = Array.from({ length: 42 }, (_, i) => new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i))
  const marcados = itens.reduce((m, i) => {
    if (i.tipo === 'aula') return m
    const dia = i.momento ? iso(new Date(i.momento)) : i.data
    ;(m[dia] ||= new Set()).add(i.tipo)
    return m
  }, {})
  const cor = (tipos) => (tipos.has('exame') || tipos.has('recurso') ? 'bg-danger' : tipos.has('feriado') ? 'bg-teal' : tipos.has('prazo') ? 'bg-orange' : tipos.has('p1') || tipos.has('p2') ? 'bg-warning' : 'bg-primary')
  return (
    <Cartao titulo={<><i className="fa fa-calendar me-2" />{maiusculaInicial(hoje.toLocaleDateString(localAtual(), { month: 'long', year: 'numeric' }))}</>} acoes={<Link to="/calendario" className="btn btn-xs btn-white">{tx('Abrir')}</Link>}>
      <div className="p-mini-cal">
        {INICIAIS_SEMANA().map((x, i) => <span key={i} className="p-mini-cab">{x}</span>)}
        {dias.map((x) => {
          const k = iso(x)
          const t = marcados[k]
          return (
            <button key={k} type="button" className={`p-mini-dia ${x.getMonth() !== hoje.getMonth() ? 'opacity-25' : ''} ${k === iso(hoje) ? 'p-mini-hoje' : ''}`} onClick={() => navegar('/calendario')} aria-label={x.toLocaleDateString(localAtual())}>
              {x.getDate()}
              {t && <span className={`p-mini-ponto ${cor(t)}`} />}
            </button>
          )
        })}
      </div>
    </Cartao>
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
    <Cartao titulo={<><i className="fa fa-chart-bar me-2" />{tx('Notas de')} {ano.turma.anoLetivo}</>} acoes={<Link to="/notas" className="btn btn-xs btn-white">{tx('Boletim')}</Link>}>
      {linhas.every((l) => l.mac === null && l.final === null) ? <Vazio>{tx('Ainda não há notas publicadas este ano.')}</Vazio> : (
        <>
          <svg viewBox={`0 -10 ${L} ${A + 46}`} className="p-grafico" role="img" aria-label={tx('MAC e nota final por disciplina')}>
            {[5, 10, 15, 20].map((v) => <line key={v} x1="28" x2={L} y1={y(v)} y2={y(v)} className={v === 10 ? 'p-grafico-minimo' : 'p-grafico-grelha'} />)}
            {[0, 10, 20].map((v) => <text key={v} x="0" y={y(v) + 4}>{v}</text>)}
            {linhas.map((l, i) => {
              const x = 28 + i * ((L - 28) / linhas.length) + ((L - 28) / linhas.length) / 2
              return (
                <g key={l.cadeira.id}>
                  {l.mac !== null && <rect x={x - largura - 2} y={y(l.mac)} width={largura} height={A - y(l.mac)} rx="2" fill="#c9a227"><title>{tx('MAC')} {nota(l.mac)}</title></rect>}
                  {l.final !== null && l.situacao !== 'recurso' && <rect x={x + 2} y={y(l.final)} width={largura} height={A - y(l.final)} rx="2" fill={l.final < 10 ? '#e53917' : '#1e7d4b'}><title>{tx('Nota final')} {l.final}</title></rect>}
                  <text x={x} y={A + 16} textAnchor="middle">{l.cadeira.codigo}</text>
                </g>
              )
            })}
          </svg>
          <div className="d-flex gap-3 small text-muted mt-1 flex-wrap">
            <span><i className="fa fa-square me-1" style={{ color: '#c9a227' }} />{tx('MAC')}</span>
            <span><i className="fa fa-square me-1" style={{ color: '#1e7d4b' }} />{tx('Nota final')}</span>
            <span><i className="fa fa-minus me-1 text-danger" />{tx('Aprovação (10)')}</span>
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
    <Cartao titulo={<><i className="fa fa-route me-2" />{tx('Progresso no curso')}</>} acoes={<Link to="/percurso" className="btn btn-xs btn-white">{tx('Percurso')}</Link>}>
      <div className="d-flex align-items-center gap-3">
        <div className="p-anel">
          <svg viewBox="0 0 132 132" width="132" height="132" aria-hidden="true">
            <circle cx="66" cy="66" r={raio} fill="none" strokeWidth="12" className="p-anel-fundo" />
            <circle cx="66" cy="66" r={raio} fill="none" strokeWidth="12" stroke="#e53917" strokeLinecap="round" strokeDasharray={`${(pct / 100) * volta} ${volta}`} />
          </svg>
          <div className="p-anel-centro"><div><strong>{pct}%</strong><small>{tx('das horas')}</small></div></div>
        </div>
        <div className="flex-grow-1">
          <div className="d-flex justify-content-between small"><span>{tx('Disciplinas aprovadas')}</span><b>{r.aprovadas} / {r.disciplinas}</b></div>
          <div className="d-flex justify-content-between small"><span>{tx('Horas concluídas')}</span><b>{r.horasAprovadas} {tx('h')}</b></div>
          <div className="d-flex justify-content-between small"><span>{tx('Em curso')}</span><b>{r.emCurso}</b></div>
          <div className="d-flex justify-content-between small"><span>{tx('Reprovadas')}</span><b className={r.reprovadas ? 'text-danger' : ''}>{r.reprovadas}</b></div>
        </div>
      </div>
    </Cartao>
  )
}

export default Inicio
