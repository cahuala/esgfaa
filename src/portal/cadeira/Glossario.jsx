import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { useSessao } from '../sessaoContexto'
import { Campo, Cartao, Carregando, Vazio } from '../componentes'

const sem = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()

// glossário da cadeira: termos por ordem alfabética, pesquisa, propostas dos estudantes aprovadas pelo docente
function Glossario({ c, eDocente, avisar }) {
  const { conta } = useSessao()
  const [termos, setTermos] = useState(null)
  const [q, setQ] = useState('')
  const [letra, setLetra] = useState('')
  const [editar, setEditar] = useState(null) // termo em edição (ou {} para novo)
  const falhou = useCallback((e) => avisar({ tipo: 'erro', texto: e.message }), [avisar])
  const carregar = useCallback(() => api(`/cadeiras/${c.id}/glossario`).then(setTermos).catch(falhou), [c.id, falhou])
  useEffect(() => { carregar() }, [carregar])
  if (!termos) return <Carregando />

  const letras = [...new Set(termos.map((t) => sem(t.termo)[0]))].sort()
  const procura = sem(q.trim())
  const lista = termos.filter((t) => (!letra || sem(t.termo)[0] === letra) && (!procura || sem(t.termo).includes(procura) || sem(t.definicao).includes(procura)))
  const pendentes = termos.filter((t) => !t.aprovado).length
  const aprovar = (t) => api(`/glossario/${t.id}`, { metodo: 'PUT', corpo: { aprovado: true } }).then(() => { avisar({ texto: `"${t.termo}" aprovado.` }); carregar() }).catch(falhou)
  const apagar = (t) => window.confirm(`Apagar "${t.termo}"?`) && api(`/glossario/${t.id}`, { metodo: 'DELETE' }).then(carregar).catch(falhou)

  return (
    <div className="p-grelha-lado">
      <Cartao titulo={<><i className="fa fa-book me-2" />Glossário ({termos.filter((t) => t.aprovado).length} termos)</>} corpo={false}>
        <div className="panel-body pb-2">
          <input className="form-control mb-2" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar termo ou definição" aria-label="Pesquisar no glossário" />
          <div className="d-flex flex-wrap gap-1">
            <button type="button" className={`btn btn-xs ${!letra ? 'btn-theme' : 'btn-white'}`} onClick={() => setLetra('')}>Todas</button>
            {letras.map((l) => <button key={l} type="button" className={`btn btn-xs ${letra === l ? 'btn-theme' : 'btn-white'}`} onClick={() => setLetra(l)}>{l}</button>)}
          </div>
          {eDocente && pendentes > 0 && <div className="alert alert-warning py-2 small mt-2 mb-0">{pendentes} termo(s) à espera de aprovação.</div>}
        </div>
        {lista.length === 0 ? <div className="panel-body"><Vazio>{termos.length ? 'Nenhum termo encontrado.' : 'O glossário ainda está vazio. Proponha o primeiro termo.'}</Vazio></div> : (
          <div className="list-group list-group-flush">
            {lista.map((t) => (
              <div key={t.id} className={`list-group-item ${t.aprovado ? '' : 'bg-light'}`}>
                <div className="d-flex align-items-start gap-2">
                  <div className="flex-grow-1">
                    <b className="fs-15px">{t.termo}</b>
                    {!t.aprovado && <span className="badge bg-warning text-dark ms-2">Por aprovar</span>}
                    <p className="p-texto-pre mb-1 mt-1">{t.definicao}</p>
                    <div className="small text-muted">{t.autor.nome}{t.autor.tipo === 'docente' && ' (docente)'}</div>
                  </div>
                  <div className="d-flex gap-1 flex-shrink-0">
                    {eDocente && !t.aprovado && <button type="button" className="btn btn-xs btn-success" onClick={() => aprovar(t)}><i className="fa fa-check me-1" />Aprovar</button>}
                    {(eDocente || (!t.aprovado && t.autor.id === conta.id)) && (
                      <>
                        <button type="button" className="btn btn-xs btn-white" onClick={() => setEditar(t)} aria-label={`Editar ${t.termo}`}><i className="fa fa-pen" /></button>
                        <button type="button" className="btn btn-xs btn-white text-danger" onClick={() => apagar(t)} aria-label={`Apagar ${t.termo}`}><i className="fa fa-trash-alt" /></button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Cartao>
      <FormTermo key={editar?.id || 'novo'} c={c} termo={editar} eDocente={eDocente} avisar={avisar} feito={() => { setEditar(null); carregar() }} cancelar={() => setEditar(null)} />
    </div>
  )
}

function FormTermo({ c, termo, eDocente, avisar, feito, cancelar }) {
  const [f, setF] = useState({ termo: termo?.termo || '', definicao: termo?.definicao || '' })
  const [erro, setErro] = useState('')
  async function guardar(e) {
    e.preventDefault()
    setErro('')
    try {
      if (termo?.id) await api(`/glossario/${termo.id}`, { metodo: 'PUT', corpo: f })
      else await api(`/cadeiras/${c.id}/glossario`, { metodo: 'POST', corpo: f })
      avisar({ texto: termo?.id ? 'Termo guardado.' : eDocente ? 'Termo juntado ao glossário.' : 'Termo proposto: fica visível depois de o docente aprovar.' })
      setF({ termo: '', definicao: '' })
      feito()
    } catch (falha) {
      setErro(falha.message)
    }
  }
  return (
    <Cartao titulo={<><i className={`fa ${termo?.id ? 'fa-pen' : 'fa-plus'} me-2`} />{termo?.id ? 'Editar termo' : eDocente ? 'Novo termo' : 'Propor um termo'}</>}>
      <form onSubmit={guardar} className="p-formulario">
        {erro && <p className="p-erro" role="alert">{erro}</p>}
        <Campo id="g-termo" rotulo="Termo"><input id="g-termo" value={f.termo} onChange={(e) => setF({ ...f, termo: e.target.value })} maxLength={120} required /></Campo>
        <Campo id="g-def" rotulo="Definição"><textarea id="g-def" rows={5} value={f.definicao} onChange={(e) => setF({ ...f, definicao: e.target.value })} maxLength={5000} required /></Campo>
        <div className="d-flex gap-2">
          <button type="submit" className="btn btn-theme">{termo?.id ? 'Guardar' : eDocente ? 'Juntar' : 'Propor'}</button>
          {termo?.id && <button type="button" className="btn btn-white" onClick={cancelar}>Cancelar</button>}
        </div>
      </form>
    </Cartao>
  )
}

export default Glossario
