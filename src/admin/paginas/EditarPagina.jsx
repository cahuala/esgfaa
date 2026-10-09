import { useCallback, useEffect, useState } from 'react'
import { Navigate, useBlocker, useParams } from 'react-router-dom'
import { api } from '../api'
import { PAGINAS } from '../esquemas'
import { Formulario } from '../componentes/Campo'
import { Aviso, CabecalhoPagina, Carregando, Erro } from '../componentes/Ui'

const SITE = import.meta.env.BASE_URL.replace(/\/$/, '')

function EditarPagina() {
  const { chave } = useParams()
  const def = PAGINAS[chave]
  const [dados, setDados] = useState(null)
  const [original, setOriginal] = useState(null)
  const [pessoas, setPessoas] = useState([])
  const [separador, setSeparador] = useState(0)
  const [erro, setErro] = useState('')
  const [aGuardar, setAGuardar] = useState(false)
  const [aviso, setAviso] = useState(null)

  const carregar = useCallback(() => {
    if (!def) return
    Promise.all([api(`/paginas/${chave}`), api('/colecoes/pessoas')])
      .then(([p, lista]) => {
        setDados(p)
        setOriginal(JSON.stringify(p))
        setPessoas(lista)
      })
      .catch((e) => setErro(e.message))
  }, [chave, def])
  useEffect(carregar, [carregar])

  const alterado = dados !== null && JSON.stringify(dados) !== original
  const bloqueio = useBlocker(({ currentLocation, nextLocation }) => alterado && currentLocation.pathname !== nextLocation.pathname)

  if (!def) return <Navigate to="/" replace />

  async function guardar(e) {
    e.preventDefault()
    setAGuardar(true)
    try {
      const guardado = await api(`/paginas/${chave}`, { metodo: 'PUT', corpo: dados })
      setDados(guardado)
      setOriginal(JSON.stringify(guardado))
      setAviso({ texto: 'Página guardada e publicada.' })
    } catch (falha) {
      setAviso({ tipo: 'erro', texto: falha.message })
    } finally {
      setAGuardar(false)
    }
  }

  return (
    <>
      <CabecalhoPagina titulo={def.titulo} subtitulo="conteúdos da página" migalhas={[{ rotulo: 'Páginas do site' }, { rotulo: def.titulo }]}>
        <a href={`${SITE}${def.rota}`} target="_blank" rel="noreferrer" className="btn btn-white">
          <i className="fa fa-external-link-alt me-1" /> Ver no site
        </a>
      </CabecalhoPagina>

      {erro && <Erro texto={erro} onRepetir={() => { setErro(''); carregar() }} />}
      {!dados && !erro && <Carregando />}

      {dados && (
        <form onSubmit={guardar}>
          <ul className="nav nav-tabs nav-tabs-inverse">
            {def.grupos.map((g, i) => (
              <li key={g.titulo} className="nav-item">
                <button type="button" className={`nav-link ${i === separador ? 'active' : ''}`} onClick={() => setSeparador(i)}>{g.titulo}</button>
              </li>
            ))}
          </ul>
          <div className="tab-content panel rounded-0 rounded-bottom p-3 mb-3">
            <Formulario campos={def.grupos[separador].campos} valor={dados} onChange={setDados} contexto={{ pessoas }} />
          </div>

          <div className="barra-guardar">
            <span className="text-muted">
              {alterado ? <><i className="fa fa-circle text-warning fs-8px me-2" />Alterações por guardar</> : <><i className="fa fa-check text-success me-2" />Tudo guardado</>}
            </span>
            <button type="submit" className="btn btn-theme" disabled={aGuardar || !alterado}>
              {aGuardar ? <><span className="spinner-border spinner-border-sm me-1" /> A guardar…</> : <><i className="fa fa-save me-1" /> Guardar e publicar</>}
            </button>
          </div>
        </form>
      )}

      {bloqueio.state === 'blocked' && (
        <>
          <div className="modal d-block" role="dialog" aria-modal="true">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header"><h4 className="modal-title">Alterações por guardar</h4></div>
                <div className="modal-body">Se sair agora, perde as alterações que fez a esta página.</div>
                <div className="modal-footer">
                  <button className="btn btn-white" onClick={() => bloqueio.reset()}>Continuar a editar</button>
                  <button className="btn btn-danger" onClick={() => bloqueio.proceed()}>Sair sem guardar</button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" />
        </>
      )}

      <Aviso aviso={aviso} onFechar={() => setAviso(null)} />
    </>
  )
}

export default EditarPagina
