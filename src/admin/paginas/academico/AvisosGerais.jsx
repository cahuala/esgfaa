import { useCallback, useEffect, useState } from 'react'
import { api } from '../../api'
import { useSessao } from '../../sessaoContexto'
import { Aviso, CabecalhoPagina, Carregando, Erro, Painel } from '../../componentes/Ui'
import { dataHora } from '../../formatar'
import { confirmar } from '../../../portal/dialogos'

// avisos da Secretaria no portal (para todos os estudantes ou só para uma turma)
function AvisosGerais() {
  const { pode } = useSessao()
  const [lista, setLista] = useState(null)
  const [turmas, setTurmas] = useState([])
  const [erro, setErro] = useState('')
  const [f, setF] = useState({ turmaId: '', titulo: '', texto: '' })
  const [aviso, setAviso] = useState(null)

  const carregar = useCallback(() => api('/academico/avisos').then(setLista).catch((e) => setErro(e.message)), [])
  useEffect(() => {
    carregar()
    api('/academico/turmas').then(setTurmas).catch(() => {})
  }, [carregar])

  async function publicar(e) {
    e.preventDefault()
    try {
      await api('/academico/avisos', { metodo: 'POST', corpo: { ...f, turmaId: f.turmaId ? Number(f.turmaId) : null } })
      setF({ turmaId: '', titulo: '', texto: '' })
      setAviso({ texto: 'Aviso publicado no portal.' })
      carregar()
    } catch (falha) {
      setAviso({ tipo: 'erro', texto: falha.message })
    }
  }

  return (
    <>
      <CabecalhoPagina titulo="Avisos do portal" subtitulo="da Administração Escolar" migalhas={[{ rotulo: 'Administração Escolar' }, { rotulo: 'Avisos' }]} />
      <div className="row">
        <div className="col-xl-8">
          {erro && <Erro texto={erro} />}
          {!lista && !erro ? <Carregando /> : lista?.map((a) => (
            <Painel key={a.id} titulo={a.titulo} acoes={pode('academico.gerir') && (
              <button type="button" className="btn btn-xs btn-icon btn-danger" title="Apagar" onClick={async () => { if (await confirmar('Apagar este aviso?', { titulo: 'Apagar aviso', botao: 'Apagar', perigo: true })) api(`/academico/avisos/${a.id}`, { metodo: 'DELETE' }).then(carregar) }}><i className="fa fa-times" /></button>
            )}>
              <p style={{ whiteSpace: 'pre-wrap' }}>{a.texto}</p>
              <div className="small text-muted">{a.turma ? `Turma ${a.turma}` : 'Todos os estudantes'} · {dataHora(a.criadoEm)}</div>
            </Painel>
          ))}
          {lista?.length === 0 && <div className="alert alert-info">Ainda não há avisos.</div>}
        </div>
        {pode('academico.gerir') && (
          <div className="col-xl-4">
            <Painel titulo="Novo aviso">
              <form onSubmit={publicar}>
                <label className="form-label fw-bold" htmlFor="ag-turma">Para</label>
                <select id="ag-turma" className="form-select mb-3" value={f.turmaId} onChange={(e) => setF({ ...f, turmaId: e.target.value })}>
                  <option value="">Todos os estudantes</option>
                  {turmas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </select>
                <label className="form-label fw-bold" htmlFor="ag-titulo">Título</label>
                <input id="ag-titulo" className="form-control mb-3" value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} required />
                <label className="form-label fw-bold" htmlFor="ag-texto">Texto</label>
                <textarea id="ag-texto" className="form-control mb-3" rows={5} value={f.texto} onChange={(e) => setF({ ...f, texto: e.target.value })} required />
                <button type="submit" className="btn btn-theme w-100"><i className="fa fa-bullhorn me-1" /> Publicar</button>
              </form>
            </Painel>
          </div>
        )}
      </div>
      <Aviso aviso={aviso} onFechar={() => setAviso(null)} />
    </>
  )
}

export default AvisosGerais
