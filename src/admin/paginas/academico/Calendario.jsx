import { useCallback, useEffect, useState } from 'react'
import { api } from '../../api'
import { useSessao } from '../../sessaoContexto'
import { Aviso, CabecalhoPagina, Carregando, Erro, Painel } from '../../componentes/Ui'

const TIPOS = {
  geral: ['bg-primary', 'Evento'], feriado: ['bg-teal', 'Feriado / sem aulas'],
  p1: ['bg-warning text-dark', '1.ª Prova'], p2: ['bg-warning text-dark', '2.ª Prova'], exame: ['bg-danger', 'Exame'], recurso: ['bg-dark', 'Recurso'],
}
const data = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('pt-PT', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })

/*
  Calendário académico da Administração Escolar: eventos da Escola inteira ou de uma turma
  (início de semestre, épocas de exames, feriados, cerimónias) e datas de provas das cadeiras.
  Aparecem no calendário do portal; os feriados tiram as aulas desse dia.
*/
function CalendarioAcademico() {
  const { pode } = useSessao()
  const gerir = pode('academico.gerir')
  const [lista, setLista] = useState(null)
  const [turmas, setTurmas] = useState([])
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState(null)
  const vazio = { tipo: 'geral', ambito: '', titulo: '', data: '', inicio: '', fim: '', local: '', descricao: '' }
  const [f, setF] = useState(vazio)
  const [erroF, setErroF] = useState('')

  const carregar = useCallback(() => api('/academico/eventos').then(setLista).catch((e) => setErro(e.message)), [])
  useEffect(() => {
    carregar()
    api('/academico/turmas').then((l) => setTurmas(l.filter((t) => t.ativa))).catch(() => {})
  }, [carregar])

  async function criar(e) {
    e.preventDefault()
    setErroF('')
    try {
      const { ambito, ...dados } = f
      await api('/academico/eventos', { metodo: 'POST', corpo: { ...dados, turmaId: ambito ? Number(ambito) : null } })
      setF({ ...vazio, tipo: f.tipo, ambito: f.ambito })
      setAviso({ texto: 'Evento marcado. Já aparece no calendário do portal.' })
      carregar()
    } catch (falha) {
      setErroF(falha.message)
    }
  }

  if (erro) return <Erro texto={erro} />
  const hoje = new Date().toISOString().slice(0, 10)
  const futuros = (lista || []).filter((e) => e.data >= hoje).sort((a, b) => a.data.localeCompare(b.data))
  const passados = (lista || []).filter((e) => e.data < hoje)

  const linha = (e) => (
    <tr key={e.id}>
      <td className="text-nowrap">{data(e.data)}{e.inicio && <div className="small text-muted">{e.inicio}{e.fim && `–${e.fim}`}</div>}</td>
      <td><span className={`badge ${TIPOS[e.tipo]?.[0] || 'bg-primary'} me-2`}>{TIPOS[e.tipo]?.[1] || e.tipo}</span><b>{e.titulo}</b>{e.local && <div className="small text-muted">{e.local}</div>}</td>
      <td className="small">{e.turma?.nome || 'Toda a Escola'}</td>
      <td className="text-end">{gerir && <button type="button" className="btn btn-xs btn-white text-danger" aria-label="Apagar evento" onClick={() => api(`/academico/eventos/${e.id}`, { metodo: 'DELETE' }).then(carregar).catch((x) => setAviso({ tipo: 'erro', texto: x.message }))}><i className="fa fa-times" /></button>}</td>
    </tr>
  )

  return (
    <>
      <CabecalhoPagina titulo="Calendário académico" subtitulo="eventos, épocas e feriados" migalhas={[{ rotulo: 'Administração Escolar' }, { rotulo: 'Calendário académico' }]} />
      <div className="row">
        <div className="col-xl-8">
          <Painel titulo="Próximos" corpo={false}>
            {!lista ? <div className="panel-body"><Carregando /></div> : (
              <div className="table-responsive">
                <table className="table table-striped align-middle mb-0">
                  <thead><tr><th>Data</th><th>Evento</th><th>Para</th><th /></tr></thead>
                  <tbody>
                    {futuros.length === 0 && <tr><td colSpan={4} className="text-center text-muted py-4">Nada marcado.</td></tr>}
                    {futuros.map(linha)}
                  </tbody>
                </table>
              </div>
            )}
          </Painel>
          {passados.length > 0 && (
            <Painel titulo="Já passaram" corpo={false}>
              <div className="table-responsive"><table className="table align-middle mb-0 opacity-75"><tbody>{passados.map(linha)}</tbody></table></div>
            </Painel>
          )}
        </div>
        {gerir && (
          <div className="col-xl-4">
            <Painel titulo="Marcar evento">
              <form onSubmit={criar}>
                {erroF && <div className="alert alert-danger py-2">{erroF}</div>}
                <label className="form-label fw-bold" htmlFor="ev-tipo">Tipo</label>
                <select id="ev-tipo" className="form-select mb-2" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
                  <option value="geral">Evento (início de semestre, época de exames, cerimónia…)</option>
                  <option value="feriado">Feriado / dia sem aulas</option>
                </select>
                <label className="form-label fw-bold" htmlFor="ev-ambito">Para</label>
                <select id="ev-ambito" className="form-select mb-2" value={f.ambito} onChange={(e) => setF({ ...f, ambito: e.target.value })}>
                  <option value="">Toda a Escola</option>
                  {turmas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </select>
                <label className="form-label fw-bold" htmlFor="ev-titulo">Título</label>
                <input id="ev-titulo" className="form-control mb-2" value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} placeholder={f.tipo === 'feriado' ? 'Dia da Independência' : 'Início do 2.º semestre'} required />
                <div className="row g-2 mb-2">
                  <div className="col-6"><label className="form-label fw-bold" htmlFor="ev-data">Data</label><input id="ev-data" type="date" className="form-control" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} required /></div>
                  <div className="col-3"><label className="form-label" htmlFor="ev-ini">Início</label><input id="ev-ini" type="time" className="form-control" value={f.inicio} onChange={(e) => setF({ ...f, inicio: e.target.value })} /></div>
                  <div className="col-3"><label className="form-label" htmlFor="ev-fim">Fim</label><input id="ev-fim" type="time" className="form-control" value={f.fim} onChange={(e) => setF({ ...f, fim: e.target.value })} /></div>
                </div>
                <label className="form-label" htmlFor="ev-local">Local</label>
                <input id="ev-local" className="form-control mb-2" value={f.local} onChange={(e) => setF({ ...f, local: e.target.value })} />
                <label className="form-label" htmlFor="ev-desc">Descrição</label>
                <textarea id="ev-desc" rows={2} className="form-control mb-3" value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} />
                <button type="submit" className="btn btn-theme w-100"><i className="fa fa-calendar-plus me-1" /> Marcar</button>
                <p className="small text-muted mt-2 mb-0">As datas das provas, exame e recurso de cada cadeira são marcadas pelos docentes no portal.</p>
              </form>
            </Painel>
          </div>
        )}
      </div>
      <Aviso aviso={aviso} onFechar={() => setAviso(null)} />
    </>
  )
}

export default CalendarioAcademico
