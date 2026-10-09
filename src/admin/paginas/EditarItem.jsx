import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useBlocker, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { COLECOES } from '../esquemas'
import { Formulario } from '../componentes/Campo'
import { ler } from '../caminhos'
import { Aviso, CabecalhoPagina, Carregando, Erro, Painel } from '../componentes/Ui'

const SITE = import.meta.env.BASE_URL.replace(/\/$/, '')

// campos com sugestões tiradas dos valores já usados na coleção
const CAMPOS_SUGESTOES = ['categoria', 'area', 'tipo']

function EditarItem() {
  const { colecao, id } = useParams()
  const def = COLECOES[colecao]
  const navegar = useNavigate()
  const novo = !id

  const [item, setItem] = useState(null)
  const [original, setOriginal] = useState(null)
  const [contexto, setContexto] = useState({ pessoas: [], sugestoes: {} })
  const [erro, setErro] = useState('')
  const [aGuardar, setAGuardar] = useState(false)
  const [aviso, setAviso] = useState(null)

  const carregar = useCallback(() => {
    if (!def) return
    const pedidoItem = novo ? Promise.resolve(def.novo()) : api(`/colecoes/${colecao}/${id}`)
    Promise.all([pedidoItem, api(`/colecoes/${colecao}`), api('/colecoes/pessoas')])
      .then(([i, todos, pessoas]) => {
        setItem(i)
        setOriginal(JSON.stringify(i))
        const sugestoes = Object.fromEntries(CAMPOS_SUGESTOES.map((c) => [c, [...new Set(todos.map((x) => x[c]).filter(Boolean))]]))
        setContexto({ pessoas, sugestoes })
      })
      .catch((e) => setErro(e.message))
  }, [colecao, id, novo, def])
  useEffect(carregar, [carregar])

  const alterado = item !== null && JSON.stringify(item) !== original

  // avisa antes de sair com alterações por guardar
  const bloqueio = useBlocker(({ currentLocation, nextLocation }) => alterado && !aGuardar && currentLocation.pathname !== nextLocation.pathname)
  useEffect(() => {
    const antesDeSair = (e) => { if (alterado) e.preventDefault() }
    window.addEventListener('beforeunload', antesDeSair)
    return () => window.removeEventListener('beforeunload', antesDeSair)
  }, [alterado])

  if (!def) return <Navigate to="/" replace />

  async function guardar(e) {
    e.preventDefault()
    const emFalta = def.campos.filter((c) => c.obrigatorio && !String(ler(item, c.nome) ?? '').trim())
    if (emFalta.length) {
      setAviso({ tipo: 'erro', texto: `Preencha: ${emFalta.map((c) => c.rotulo).join(', ')}.` })
      return
    }
    setAGuardar(true)
    try {
      const guardado = novo
        ? await api(`/colecoes/${colecao}`, { metodo: 'POST', corpo: item })
        : await api(`/colecoes/${colecao}/${id}`, { metodo: 'PUT', corpo: item })
      setItem(guardado)
      setOriginal(JSON.stringify(guardado))
      setAviso({ texto: novo ? `${def.feminino ? 'Publicada' : 'Publicado'} com sucesso.` : 'Alterações guardadas e publicadas.' })
      if (novo) navegar(`/colecao/${colecao}/${guardado[def.chave]}`, { replace: true })
    } catch (falha) {
      setAviso({ tipo: 'erro', texto: falha.message })
    } finally {
      setAGuardar(false)
    }
  }

  const titulo = item?.[def.campoTitulo]

  return (
    <>
      <CabecalhoPagina
        titulo={novo ? def.botaoNovo : 'Editar'}
        subtitulo={!novo && titulo}
        migalhas={[{ rotulo: def.titulo, para: `/colecao/${colecao}` }, { rotulo: novo ? def.botaoNovo : 'Editar' }]}
      >
        {!novo && def.rotaSite && item && (
          <a href={`${SITE}${def.rotaSite(item)}`} target="_blank" rel="noreferrer" className="btn btn-white">
            <i className="fa fa-external-link-alt me-1" /> Ver no site
          </a>
        )}
      </CabecalhoPagina>

      {erro && <Erro texto={erro} onRepetir={() => { setErro(''); carregar() }} />}
      {!item && !erro && <Carregando />}

      {item && (
        <form onSubmit={guardar} noValidate>
          <Painel titulo={def.titulo}>
            <Formulario campos={def.campos} valor={item} onChange={setItem} contexto={contexto} />
          </Painel>

          <div className="barra-guardar">
            <span className="text-muted">
              {alterado ? <><i className="fa fa-circle text-warning fs-8px me-2" />Alterações por guardar</> : <><i className="fa fa-check text-success me-2" />Tudo guardado</>}
            </span>
            <div className="d-flex gap-2">
              <Link to={`/colecao/${colecao}`} className="btn btn-white">Voltar à lista</Link>
              <button type="submit" className="btn btn-theme" disabled={aGuardar || (!alterado && !novo)}>
                {aGuardar ? <><span className="spinner-border spinner-border-sm me-1" /> A guardar…</> : <><i className="fa fa-save me-1" /> {novo ? 'Publicar' : 'Guardar e publicar'}</>}
              </button>
            </div>
          </div>
        </form>
      )}

      {bloqueio.state === 'blocked' && (
        <>
          <div className="modal d-block" role="dialog" aria-modal="true">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header"><h4 className="modal-title">Alterações por guardar</h4></div>
                <div className="modal-body">Se sair agora, perde as alterações que fez a este conteúdo.</div>
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

export default EditarItem
