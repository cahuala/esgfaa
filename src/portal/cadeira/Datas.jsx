import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { Campo, Cartao, Vazio } from '../componentes'
import { DIAS, data } from '../formatar'

const TIPOS = { p1: '1.ª Prova', p2: '2.ª Prova', exame: 'Exame', recurso: 'Recurso', geral: 'Outro' }
const CORES = { p1: 'bg-warning text-dark', p2: 'bg-warning text-dark', exame: 'bg-danger', recurso: 'bg-dark', geral: 'bg-primary' }

// horário semanal e datas das provas, exame e recurso (o docente marca-as)
function Datas({ c, eDocente, avisar }) {
  const [eventos, setEventos] = useState([])
  const falhou = useCallback((e) => avisar({ tipo: 'erro', texto: e.message }), [avisar])
  const carregar = useCallback(() => api(`/cadeiras/${c.id}/eventos`).then(setEventos).catch(falhou), [c.id, falhou])
  useEffect(() => { carregar() }, [carregar])

  return (
    <div className="row">
      <div className={eDocente ? 'col-xl-7' : 'col-12'}>
        <Cartao titulo={<><i className="fa fa-calendar-check me-2" />Provas e exames</>} corpo={false}>
          {eventos.length === 0 ? <div className="panel-body"><Vazio>As datas ainda não foram marcadas.</Vazio></div> : (
            <div className="list-group list-group-flush">
              {eventos.map((e) => (
                <div key={e.id} className="list-group-item d-flex gap-3 align-items-center">
                  <div className="text-center" style={{ width: 64 }}>
                    <div className="fs-20px fw-bold lh-1">{e.data.slice(8)}</div>
                    <div className="small text-uppercase text-muted">{new Date(`${e.data}T12:00:00`).toLocaleDateString('pt-PT', { month: 'short' })}</div>
                  </div>
                  <div className="flex-grow-1">
                    <span className={`badge ${CORES[e.tipo] || 'bg-primary'} me-2`}>{TIPOS[e.tipo] || e.tipo}</span><b>{e.titulo}</b>
                    <div className="small text-muted">{data(e.data)}{e.inicio && `, ${e.inicio}${e.fim ? `–${e.fim}` : ''}`}{e.local && ` · ${e.local}`}</div>
                    {e.descricao && <div className="small">{e.descricao}</div>}
                  </div>
                  {eDocente && <button type="button" className="btn btn-xs btn-white text-danger" aria-label="Apagar data" onClick={() => api(`/eventos/${e.id}`, { metodo: 'DELETE' }).then(carregar).catch(falhou)}><i className="fa fa-times" /></button>}
                </div>
              ))}
            </div>
          )}
        </Cartao>
        <Cartao titulo={<><i className="fa fa-clock me-2" />Horário semanal</>}>
          {c.horario.length === 0 ? <Vazio>Sem horário publicado.</Vazio> : (
            <ul className="p-lista">
              {c.horario.map((h) => <li key={h.id}><strong>{DIAS[h.diaSemana]}</strong>, {h.inicio}–{h.fim}{h.sala && ` · ${h.sala}`}</li>)}
            </ul>
          )}
        </Cartao>
      </div>
      {eDocente && <div className="col-xl-5"><NovaData c={c} avisar={avisar} criada={carregar} /></div>}
    </div>
  )
}

function NovaData({ c, avisar, criada }) {
  const vazio = { tipo: 'p1', titulo: '', data: '', inicio: '', fim: '', local: '', descricao: '' }
  const [f, setF] = useState(vazio)
  const [erro, setErro] = useState('')
  async function marcar(e) {
    e.preventDefault()
    setErro('')
    try {
      await api(`/cadeiras/${c.id}/eventos`, { metodo: 'POST', corpo: f })
      setF(vazio)
      avisar({ texto: 'Data marcada. Os estudantes já a veem no calendário.' })
      criada()
    } catch (falha) {
      setErro(falha.message)
    }
  }
  return (
    <Cartao titulo={<><i className="fa fa-plus me-2" />Marcar data</>}>
      <form onSubmit={marcar} className="p-formulario">
        {erro && <p className="p-erro" role="alert">{erro}</p>}
        <Campo id="d-tipo" rotulo="O quê"><select id="d-tipo" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>{Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Campo>
        <Campo id="d-titulo" rotulo="Título (opcional)"><input id="d-titulo" value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} placeholder={TIPOS[f.tipo]} /></Campo>
        <div className="row g-2">
          <div className="col-sm-6"><Campo id="d-data" rotulo="Data"><input id="d-data" type="date" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} required /></Campo></div>
          <div className="col-sm-3"><Campo id="d-inicio" rotulo="Início"><input id="d-inicio" type="time" value={f.inicio} onChange={(e) => setF({ ...f, inicio: e.target.value })} /></Campo></div>
          <div className="col-sm-3"><Campo id="d-fim" rotulo="Fim"><input id="d-fim" type="time" value={f.fim} onChange={(e) => setF({ ...f, fim: e.target.value })} /></Campo></div>
        </div>
        <Campo id="d-local" rotulo="Local"><input id="d-local" value={f.local} onChange={(e) => setF({ ...f, local: e.target.value })} /></Campo>
        <Campo id="d-desc" rotulo="Notas (opcional)"><textarea id="d-desc" rows={2} value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} /></Campo>
        <div><button type="submit" className="btn btn-theme">Marcar</button></div>
      </form>
    </Cartao>
  )
}

export default Datas
