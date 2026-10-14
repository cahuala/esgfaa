import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { Cartao, Carregando, Erro, Titulo, Vazio } from '../componentes'
import { data as dataLonga, maiusculaInicial } from '../formatar'

const TIPOS = {
  aula: ['bg-gray-500', 'Aula'],
  prazo: ['bg-orange', 'Entrega de trabalho'],
  questionario: ['bg-purple', 'Questionário'],
  p1: ['bg-yellow text-dark', '1.ª Prova'],
  p2: ['bg-yellow text-dark', '2.ª Prova'],
  exame: ['bg-red', 'Exame'],
  recurso: ['bg-dark', 'Recurso'],
  geral: ['bg-blue', 'Evento'],
  feriado: ['bg-teal', 'Feriado / sem aulas'],
}
const SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// grelha de 6 semanas (segunda a domingo) que contém o mês
function grelha(ano, mes) {
  const primeiro = new Date(ano, mes, 1)
  const inicio = new Date(ano, mes, 1 - ((primeiro.getDay() + 6) % 7))
  return Array.from({ length: 42 }, (_, i) => new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i))
}

// calendário académico: aulas, provas, exames, recurso, entregas, questionários e eventos da Escola
function Calendario() {
  const hoje = iso(new Date())
  const [mes, setMes] = useState(() => { const d = new Date(); return { ano: d.getFullYear(), mes: d.getMonth() } })
  const [itens, setItens] = useState(null)
  const [erro, setErro] = useState('')
  const [dia, setDia] = useState(hoje)
  const [comAulas, setComAulas] = useState(true)
  const dias = useMemo(() => grelha(mes.ano, mes.mes), [mes])

  useEffect(() => {
    let atual = true
    api(`/calendario?de=${iso(dias[0])}&ate=${iso(dias[41])}`)
      .then((r) => { if (atual) { setErro(''); setItens(r) } })
      .catch((e) => { if (atual) setErro(e.message) })
    return () => { atual = false }
  }, [dias])

  // prazos e questionários trazem o momento exato: dia e hora no fuso de quem vê
  const locais = (itens || []).map((i) => (i.momento ? { ...i, data: iso(new Date(i.momento)), inicio: new Date(i.momento).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) } : i))
  const visiveis = locais.filter((i) => comAulas || i.tipo !== 'aula')
  const porDia = visiveis.reduce((m, i) => ((m[i.data] ||= []).push(i), m), {})
  const mover = (n) => setMes(({ ano, mes: m }) => { const d = new Date(ano, m + n, 1); return { ano: d.getFullYear(), mes: d.getMonth() } })
  const titulo = maiusculaInicial(new Date(mes.ano, mes.mes, 1).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' }))
  const proximos = visiveis.filter((i) => i.data >= hoje && i.tipo !== 'aula').slice(0, 8)

  return (
    <>
      <Titulo rotulo="Calendário" titulo="Calendário académico" sub="aulas, provas, exames, entregas e eventos" />
      {erro && <Erro texto={erro} />}
      <div className="row">
        <div className="col-xl-9">
          <Cartao
            titulo={<><i className="fa fa-calendar-alt me-2" />{titulo}</>}
            acoes={(
              <div className="d-flex gap-1">
                <button type="button" className="btn btn-xs btn-white" onClick={() => mover(-1)} aria-label="Mês anterior"><i className="fa fa-chevron-left" /></button>
                <button type="button" className="btn btn-xs btn-white" onClick={() => { const d = new Date(); setMes({ ano: d.getFullYear(), mes: d.getMonth() }); setDia(hoje) }}>Hoje</button>
                <button type="button" className="btn btn-xs btn-white" onClick={() => mover(1)} aria-label="Mês seguinte"><i className="fa fa-chevron-right" /></button>
              </div>
            )}
            corpo={false}
          >
            {!itens && !erro ? <div className="panel-body"><Carregando /></div> : (
              <div className="p-calendario" role="grid" aria-label={titulo}>
                {SEMANA.map((s) => <div key={s} className="p-cal-cabeca" role="columnheader">{s}</div>)}
                {dias.map((d) => {
                  const chave = iso(d)
                  const lista = porDia[chave] || []
                  const feriado = lista.some((i) => i.tipo === 'feriado')
                  return (
                    <button
                      key={chave}
                      type="button"
                      role="gridcell"
                      aria-selected={dia === chave}
                      className={`p-cal-dia ${d.getMonth() !== mes.mes ? 'p-cal-fora' : ''} ${chave === hoje ? 'p-cal-hoje' : ''} ${dia === chave ? 'p-cal-escolhido' : ''} ${feriado ? 'p-cal-feriado' : ''}`}
                      onClick={() => setDia(chave)}
                    >
                      <span className="p-cal-numero">{d.getDate()}</span>
                      {lista.slice(0, 3).map((i) => (
                        <span key={i.id} className={`p-cal-item badge ${TIPOS[i.tipo]?.[0] || 'bg-primary'}`}>{i.inicio && i.tipo !== 'feriado' ? `${i.inicio} ` : ''}{i.titulo}</span>
                      ))}
                      {lista.length > 3 && <span className="p-cal-mais">+{lista.length - 3}</span>}
                    </button>
                  )
                })}
              </div>
            )}
          </Cartao>
          <div className="d-flex flex-wrap gap-2 align-items-center small mb-3">
            {Object.entries(TIPOS).map(([k, [cor, nome]]) => <span key={k} className={`badge ${cor}`}>{nome}</span>)}
            <label className="form-check form-switch ms-auto mb-0">
              <input className="form-check-input" type="checkbox" checked={comAulas} onChange={(e) => setComAulas(e.target.checked)} />
              <span className="form-check-label">Mostrar as aulas</span>
            </label>
          </div>
        </div>
        <div className="col-xl-3">
          <Cartao titulo={<><i className="fa fa-calendar-day me-2" />{maiusculaInicial(new Date(`${dia}T12:00:00`).toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' }))}</>} corpo={false}>
            {!(porDia[dia] || []).length ? <div className="panel-body"><Vazio>Nada marcado.</Vazio></div> : <ListaEventos itens={porDia[dia]} />}
          </Cartao>
          <Cartao titulo={<><i className="fa fa-flag me-2" />Próximas datas</>} corpo={false}>
            {!proximos.length ? <div className="panel-body"><Vazio>Nada nas próximas semanas.</Vazio></div> : <ListaEventos itens={proximos} comData />}
          </Cartao>
        </div>
      </div>
    </>
  )
}

function ListaEventos({ itens, comData }) {
  return (
    <div className="list-group list-group-flush">
      {itens.map((i) => (
        <div key={i.id} className="list-group-item">
          <span className={`badge ${TIPOS[i.tipo]?.[0] || 'bg-primary'} me-1`}>{TIPOS[i.tipo]?.[1] || i.tipo}</span>
          <div className="fw-bold mt-1">{i.cadeiraId ? <Link to={`/cadeiras/${i.cadeiraId}`} className="text-decoration-none">{i.titulo}</Link> : i.titulo}</div>
          <div className="small text-muted">
            {comData && `${dataLonga(i.data)} · `}{i.inicio}{i.fim && `–${i.fim}`}{i.local && ` · ${i.local}`}
            {i.cadeira && i.tipo !== 'aula' && <div>{i.cadeira}</div>}
            {i.turma && <div>{i.turma}</div>}
          </div>
          {i.descricao && <div className="small">{i.descricao}</div>}
        </div>
      ))}
    </div>
  )
}

export default Calendario
