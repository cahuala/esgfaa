import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useBlocker, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { useSessao } from '../sessaoContexto'
import { COLECOES } from '../esquemas'
import { Formulario } from '../componentes/Campo'
import { ler } from '../caminhos'
import { dataHora } from '../formatar'
import { Aviso, CabecalhoPagina, Carregando, Erro, Painel } from '../componentes/Ui'

const SITE = import.meta.env.BASE_URL.replace(/\/$/, '')

// campos com sugestões tiradas dos valores já usados na coleção
const CAMPOS_SUGESTOES = ['categoria', 'area', 'tipo']

// os blocos "conteudo" ficam num painel próprio, por baixo dos dados principais
const separar = (campos) => [campos.filter((c) => c.tipo !== 'blocos'), campos.filter((c) => c.tipo === 'blocos')]

function EditarItem() {
  const { colecao, id } = useParams()
  const def = COLECOES[colecao]
  const navegar = useNavigate()
  const { pode } = useSessao()
  const novo = !id

  const [item, setItem] = useState(null)
  const [original, setOriginal] = useState(null)
  const [contexto, setContexto] = useState({ pessoas: [], sugestoes: {} })
  const [erro, setErro] = useState('')
  const [aGuardar, setAGuardar] = useState(false)
  const [aviso, setAviso] = useState(null)

  const podePublicar = pode(`${colecao}.publicar`)
  const podeEditar = pode(`${colecao}.editar`) || podePublicar
  const podeCriar = pode(`${colecao}.criar`)

  const carregar = useCallback(() => {
    if (!def) return
    const pedidoItem = novo ? Promise.resolve({ ...def.novo(), _estado: 'rascunho' }) : api(`/colecoes/${colecao}/${id}`)
    Promise.all([pedidoItem, api(`/colecoes/${colecao}`), api('/colecoes/pessoas').catch(() => [])])
      .then(([i, todos, pessoas]) => {
        setErro('')
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
  if (novo && !podeCriar) return <Navigate to={`/colecao/${colecao}`} replace />

  const publicado = item?._estado === 'publicado'
  // conteúdo publicado: só quem pode publicar altera
  const soLeitura = !novo && (!podeEditar || (publicado && !podePublicar))

  async function guardar(estado) {
    const emFalta = def.campos.filter((c) => c.obrigatorio && !String(ler(item, c.nome) ?? '').trim())
    if (estado === 'publicado' && emFalta.length) {
      setAviso({ tipo: 'erro', texto: `Para publicar, preencha: ${emFalta.map((c) => c.rotulo).join(', ')}.` })
      return
    }
    if (!String(item[def.campoTitulo] || '').trim()) {
      setAviso({ tipo: 'erro', texto: 'Indique pelo menos o título.' })
      return
    }
    setAGuardar(true)
    try {
      const corpo = { ...item, _estado: estado }
      const guardado = novo
        ? await api(`/colecoes/${colecao}`, { metodo: 'POST', corpo })
        : await api(`/colecoes/${colecao}/${id}`, { metodo: 'PUT', corpo })
      setItem(guardado)
      setOriginal(JSON.stringify(guardado))
      setAviso({
        texto: guardado._estado === 'publicado'
          ? 'Publicado — já está visível no site.'
          : podePublicar ? 'Guardado como rascunho (não aparece no site).' : 'Rascunho guardado. Um editor-chefe vai rever e publicar.',
      })
      if (novo) navegar(`/colecao/${colecao}/${guardado[def.chave]}`, { replace: true })
    } catch (falha) {
      setAviso({ tipo: 'erro', texto: falha.message })
    } finally {
      setAGuardar(false)
    }
  }

  const [principais, blocos] = separar(def.campos)
  const titulo = item?.[def.campoTitulo]

  return (
    <>
      <CabecalhoPagina
        titulo={novo ? def.botaoNovo : 'Editar'}
        subtitulo={!novo && titulo}
        migalhas={[{ rotulo: def.titulo, para: `/colecao/${colecao}` }, { rotulo: novo ? def.botaoNovo : 'Editar' }]}
      >
        {!novo && def.rotaSite && publicado && (
          <a href={`${SITE}${def.rotaSite(item)}`} target="_blank" rel="noreferrer" className="btn btn-white">
            <i className="fa fa-external-link-alt me-1" /> Ver no site
          </a>
        )}
      </CabecalhoPagina>

      {erro && <Erro texto={erro} onRepetir={() => { setErro(''); carregar() }} />}
      {!item && !erro && <Carregando />}

      {item && (
        <form onSubmit={(e) => { e.preventDefault(); guardar(podePublicar ? 'publicado' : 'rascunho') }}>
          {soLeitura && (
            <div className="alert alert-warning d-flex align-items-center">
              <i className="fa fa-lock fa-lg me-3" />
              <div>
                <b>Só de leitura.</b> {publicado
                  ? 'Este conteúdo já está publicado e o seu papel não permite alterá-lo. Peça a um editor-chefe.'
                  : 'O seu papel não permite editar este conteúdo.'}
              </div>
            </div>
          )}

          <div className="row">
            <div className="col-xl-9">
              <fieldset disabled={soLeitura}>
                <Painel titulo={`Dados ${def.feminino ? 'da' : 'do'} ${def.singular}`}>
                  <Formulario campos={principais} valor={item} onChange={setItem} contexto={contexto} horizontal />
                </Painel>

                {blocos.map((c) => (
                  <Painel key={c.nome} titulo={c.rotulo}>
                    <Formulario campos={[{ ...c, rotulo: '' }]} valor={item} onChange={setItem} contexto={contexto} />
                  </Painel>
                ))}
              </fieldset>
            </div>

            <div className="col-xl-3">
              <div className="publicacao-lateral">
                <Painel titulo="Publicação">
                  <dl className="ficha-publicacao">
                    <dt>Estado</dt>
                    <dd>
                      {publicado
                        ? <span className="badge bg-success"><i className="fa fa-globe me-1" />Publicado</span>
                        : <span className="badge bg-warning text-dark"><i className="fa fa-pencil-alt me-1" />Rascunho</span>}
                    </dd>
                    {!novo && <><dt>Última edição</dt><dd>{dataHora(item._atualizado)}{item._editadoPor && <><br /><small className="text-muted">por {item._editadoPor}</small></>}</dd></>}
                  </dl>

                  {!soLeitura && (
                    <div className="d-grid gap-2">
                      {podePublicar && (
                        <button type="button" className="btn btn-theme" disabled={aGuardar} onClick={() => guardar('publicado')}>
                          <i className="fa fa-globe me-1" /> {publicado ? 'Guardar e publicar' : 'Publicar'}
                        </button>
                      )}
                      <button type="button" className={`btn ${podePublicar ? 'btn-white' : 'btn-theme'}`} disabled={aGuardar} onClick={() => guardar('rascunho')}>
                        <i className="fa fa-save me-1" /> {podePublicar ? (publicado ? 'Retirar do site (rascunho)' : 'Guardar rascunho') : 'Guardar rascunho para revisão'}
                      </button>
                    </div>
                  )}

                  {!podePublicar && !soLeitura && (
                    <p className="small text-muted mt-3 mb-0">
                      <i className="fa fa-info-circle me-1" />O seu papel guarda rascunhos. A publicação é feita por quem tem permissão de publicar.
                    </p>
                  )}

                  <hr />
                  <div className="small">
                    {alterado
                      ? <span className="text-warning"><i className="fa fa-circle fs-8px me-2" />Alterações por guardar</span>
                      : <span className="text-success"><i className="fa fa-check me-2" />Sem alterações por guardar</span>}
                  </div>
                </Painel>

                <Link to={`/colecao/${colecao}`} className="btn btn-white w-100"><i className="fa fa-arrow-left me-1" /> Voltar à lista</Link>
              </div>
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
