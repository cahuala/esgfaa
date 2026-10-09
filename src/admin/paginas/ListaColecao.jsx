import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { COLECOES } from '../esquemas'
import { Aviso, CabecalhoPagina, Carregando, Confirmar, Erro, Painel } from '../componentes/Ui'
import { dataCurta } from '../formatar'

const SITE = import.meta.env.BASE_URL.replace(/\/$/, '')
const POR_PAGINA = 15

function ListaColecao() {
  const { colecao } = useParams()
  const def = COLECOES[colecao]
  const [itens, setItens] = useState(null)
  const [erro, setErro] = useState('')
  const [pesquisa, setPesquisa] = useState('')
  const [pagina, setPagina] = useState(1)
  const [confirmar, setConfirmar] = useState(null)
  const [aviso, setAviso] = useState(null)

  const carregar = useCallback(() => {
    api(`/colecoes/${colecao}`).then((r) => { setErro(''); setItens(r) }).catch((e) => setErro(e.message))
  }, [colecao])
  useEffect(() => {
    if (def) carregar()
  }, [carregar, def])

  if (!def) return <Navigate to="/" replace />

  const termo = pesquisa.trim().toLowerCase()
  const filtrados = (itens || []).filter((i) => !termo || def.colunas.some((c) => String(c.valor(i) ?? '').toLowerCase().includes(termo)))
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA))
  const visiveis = filtrados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA)

  function pedirApagar(item) {
    setConfirmar({
      titulo: `Apagar ${def.singular}`,
      texto: <>Vai apagar <b>“{item[def.campoTitulo]}”</b> e todos os seus gostos e comentários. Esta ação não pode ser anulada.</>,
      botao: 'Apagar',
      perigo: true,
      confirmar: async () => {
        setConfirmar(null)
        try {
          await api(`/colecoes/${colecao}/${item[def.chave]}`, { metodo: 'DELETE' })
          setItens((lista) => lista.filter((x) => x[def.chave] !== item[def.chave]))
          setAviso({ texto: `“${item[def.campoTitulo]}” foi apagado.` })
        } catch (e) {
          setAviso({ tipo: 'erro', texto: e.message })
        }
      },
    })
  }

  async function mover(i, delta) {
    const lista = [...itens]
    const j = i + delta
    if (j < 0 || j >= lista.length) return
    ;[lista[i], lista[j]] = [lista[j], lista[i]]
    setItens(lista)
    try {
      await api(`/ordem/${colecao}`, { metodo: 'PUT', corpo: { ids: lista.map((x) => x[def.chave]) } })
    } catch (e) {
      setAviso({ tipo: 'erro', texto: e.message })
      carregar()
    }
  }

  const ordenavelAgora = def.ordenavel && !termo

  return (
    <>
      <CabecalhoPagina titulo={def.titulo} subtitulo={itens ? `${itens.length} no total` : ''} migalhas={[{ rotulo: def.titulo }]}>
        <Link to={`/colecao/${colecao}/novo`} className="btn btn-theme"><i className="fa fa-plus me-1" /> {def.botaoNovo}</Link>
      </CabecalhoPagina>

      {def.ajudaLista && <div className="alert alert-info py-2"><i className="fa fa-info-circle me-2" />{def.ajudaLista}</div>}
      {erro && <Erro texto={erro} onRepetir={() => { setErro(''); carregar() }} />}

      <Painel
        titulo={`Lista de ${def.titulo.toLowerCase()}`}
        corpo={false}
        acoes={<button className="btn btn-xs btn-icon btn-success" onClick={carregar} title="Recarregar"><i className="fa fa-redo" /></button>}
      >
        <div className="panel-body pb-0">
          <div className="input-group mb-3 lista-pesquisa">
            <span className="input-group-text"><i className="fa fa-search" /></span>
            <input className="form-control" placeholder="Pesquisar…" value={pesquisa} onChange={(e) => { setPesquisa(e.target.value); setPagina(1) }} />
          </div>
        </div>

        {!itens && !erro ? <Carregando /> : (
          <div className="table-responsive">
            <table className="table table-striped table-hover align-middle mb-0">
              <thead>
                <tr>
                  {ordenavelAgora && <th style={{ width: 1 }}>Ordem</th>}
                  {def.colunas.map((c, i) => <th key={i} className={c.tipo ? 'col-imagem' : ''}>{c.rotulo}</th>)}
                  {colecao !== 'cursos' && colecao !== 'pessoas' && <th className="text-nowrap text-center" title="Visualizações · Gostos · Comentários"><i className="fa fa-eye" /> · <i className="fa fa-heart" /> · <i className="fa fa-comment" /></th>}
                  <th className="text-end" style={{ width: 1 }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.length === 0 && (
                  <tr><td colSpan={10} className="text-center text-muted py-4">{termo ? 'Nenhum resultado para a pesquisa.' : `Ainda não há ${def.titulo.toLowerCase()}.`}</td></tr>
                )}
                {visiveis.map((item) => {
                  const indice = itens.indexOf(item)
                  const est = item._estatisticas
                  return (
                    <tr key={item[def.chave]}>
                      {ordenavelAgora && (
                        <td className="text-nowrap">
                          <button className="btn btn-xs btn-white" disabled={indice === 0} onClick={() => mover(indice, -1)}><i className="fa fa-arrow-up" /></button>{' '}
                          <button className="btn btn-xs btn-white" disabled={indice === itens.length - 1} onClick={() => mover(indice, 1)}><i className="fa fa-arrow-down" /></button>
                        </td>
                      )}
                      {def.colunas.map((c, i) => {
                        const v = c.valor(item)
                        if (c.tipo === 'imagem' || c.tipo === 'avatar') {
                          return (
                            <td key={i} className="with-img">
                              {v ? <img src={v} alt="" className={`miniatura-tabela ${c.tipo === 'avatar' ? 'rounded-circle' : 'rounded'}`} /> : <span className="miniatura-tabela miniatura-vazia"><i className="fa fa-image" /></span>}
                            </td>
                          )
                        }
                        return (
                          <td key={i} className={c.principal ? 'fw-bold' : 'text-nowrap'}>
                            {c.principal
                              ? <Link to={`/colecao/${colecao}/${item[def.chave]}`} className="text-dark text-decoration-none">{v}</Link>
                              : (c.data ? dataCurta(v) : v || '—')}
                          </td>
                        )
                      })}
                      {colecao !== 'cursos' && colecao !== 'pessoas' && (
                        <td className="text-center text-nowrap text-muted">{est ? `${est.visualizacoes} · ${est.gostos} · ${est.comentarios}` : '0 · 0 · 0'}</td>
                      )}
                      <td className="text-end text-nowrap">
                        {def.rotaSite && (
                          <a href={`${SITE}${def.rotaSite(item)}`} target="_blank" rel="noreferrer" className="btn btn-sm btn-white me-1" title="Ver no site"><i className="fa fa-external-link-alt" /></a>
                        )}
                        <Link to={`/colecao/${colecao}/${item[def.chave]}`} className="btn btn-sm btn-primary me-1" title="Editar"><i className="fa fa-pencil-alt" /></Link>
                        <button className="btn btn-sm btn-danger" onClick={() => pedirApagar(item)} title="Apagar"><i className="fa fa-trash-alt" /></button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPaginas > 1 && (
          <div className="panel-body d-flex justify-content-between align-items-center">
            <span className="text-muted small">{filtrados.length} resultados</span>
            <ul className="pagination mb-0">
              {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((n) => (
                <li key={n} className={`page-item ${n === pagina ? 'active' : ''}`}>
                  <button className="page-link" onClick={() => setPagina(n)}>{n}</button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Painel>

      <Confirmar pedido={confirmar} onCancelar={() => setConfirmar(null)} />
      <Aviso aviso={aviso} onFechar={() => setAviso(null)} />
    </>
  )
}

export default ListaColecao
