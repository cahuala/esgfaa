import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { useSessao } from '../sessaoContexto'
import { COLECOES } from '../esquemas'
import { Aviso, CabecalhoPagina, Carregando, Confirmar, Erro, Painel } from '../componentes/Ui'
import { dataCurta } from '../formatar'
import Exportar from '../componentes/Exportar'
import { t as tx, localAtual } from '../../i18n/linguas'

const SITE = import.meta.env.BASE_URL.replace(/\/$/, '')
const POR_PAGINA = 15
const INTERATIVAS = ['noticias', 'eventos', 'artigos']

function ListaColecao() {
  const { colecao } = useParams()
  const def = COLECOES[colecao]
  const { pode } = useSessao()
  const [itens, setItens] = useState(null)
  const [erro, setErro] = useState('')
  const [pesquisa, setPesquisa] = useState('')
  const [estado, setEstado] = useState('')
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
  if (!pode(`${colecao}.ver`)) return <Navigate to="/" replace />

  const podeCriar = pode(`${colecao}.criar`)
  const podeApagar = pode(`${colecao}.apagar`)
  const podeOrdenar = pode(`${colecao}.editar`)
  const publicidade = colecao === 'publicidade'

  const termo = pesquisa.trim().toLowerCase()
  const filtrados = (itens || []).filter((i) =>
    (!estado || i._estado === estado)
    && (!termo || def.colunas.some((c) => String(c.valor(i) ?? '').toLowerCase().includes(termo))))
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA))
  const visiveis = filtrados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA)
  const contagem = (e) => (itens || []).filter((i) => !e || i._estado === e).length

  function pedirApagar(item) {
    setConfirmar({
      titulo: tx('Apagar {0}', { 0: def.singular }),
      texto: <>{tx('Vai apagar')} <b>“{item[def.campoTitulo]}”</b>{INTERATIVAS.includes(colecao) && tx(' e todos os seus gostos e comentários')}{tx('. Esta ação não pode ser anulada.')}</>,
      botao: tx('Apagar'),
      perigo: true,
      confirmar: async () => {
        setConfirmar(null)
        try {
          await api(`/colecoes/${colecao}/${item[def.chave]}`, { metodo: 'DELETE' })
          setItens((lista) => lista.filter((x) => x[def.chave] !== item[def.chave]))
          setAviso({ texto: tx('“{0}” foi apagado.', { 0: item[def.campoTitulo] }) })
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

  const ordenavelAgora = def.ordenavel && podeOrdenar && !termo && !estado

  return (
    <>
      <CabecalhoPagina titulo={def.titulo} subtitulo={itens ? tx('{0} no total', { 0: itens.length }) : ''} migalhas={[{ rotulo: def.titulo }]}>
        {podeCriar && <Link to={`/colecao/${colecao}/novo`} className="btn btn-theme"><i className="fa fa-plus me-1" /> {def.botaoNovo}</Link>}
      </CabecalhoPagina>

      {def.ajudaLista && <div className="alert alert-info py-2"><i className="fa fa-info-circle me-2" />{def.ajudaLista}</div>}
      {erro && <Erro texto={erro} onRepetir={() => { setErro(''); carregar() }} />}

      <ul className="nav nav-tabs nav-tabs-inverse">
        {[['', tx('Todos')], ['publicado', tx('Publicados')], ['rascunho', tx('Rascunhos')]].map(([v, r]) => (
          <li key={v} className="nav-item">
            <button type="button" className={`nav-link ${estado === v ? 'active' : ''}`} onClick={() => { setEstado(v); setPagina(1) }}>
              {r} <span className={`badge ms-1 ${v === 'rascunho' && contagem('rascunho') ? 'bg-warning text-dark' : 'bg-gray-500'}`}>{contagem(v)}</span>
            </button>
          </li>
        ))}
      </ul>

      <Painel corpo={false} className="rounded-top-0">
        <div className="panel-body pb-0">
          <div className="d-flex flex-wrap gap-2 align-items-start mb-3">
            <div className="input-group lista-pesquisa">
              <span className="input-group-text"><i className="fa fa-search" /></span>
              <input className="form-control" placeholder={tx('Pesquisar…')} value={pesquisa} onChange={(e) => { setPesquisa(e.target.value); setPagina(1) }} />
            </div>
            <Exportar
              className="ms-auto"
              titulo={def.titulo}
              filtro={[estado === 'publicado' ? tx('Publicados') : estado === 'rascunho' ? tx('Rascunhos') : '', termo && tx('pesquisa: «{0}»', { 0: pesquisa.trim() })].filter(Boolean).join(' · ')}
              linhas={filtrados}
              colunas={[
                ...def.colunas.filter((c) => !c.tipo && c.rotulo).map((c) => ({ titulo: c.rotulo, valor: (i) => (c.data ? dataCurta(c.valor(i)) : c.valor(i)) })),
                { titulo: tx('Estado'), valor: (i) => (i._estado === 'publicado' ? tx('Publicado') : tx('Rascunho')) },
                ...(INTERATIVAS.includes(colecao) ? [{ titulo: tx('Visualizações'), valor: (i) => i._estatisticas?.visualizacoes ?? 0 }, { titulo: tx('Gostos'), valor: (i) => i._estatisticas?.gostos ?? 0 }, { titulo: tx('Comentários'), valor: (i) => i._estatisticas?.comentarios ?? 0 }] : []),
              ]}
            />
          </div>
        </div>

        {!itens && !erro ? <Carregando /> : (
          <div className="table-responsive">
            <table className="table table-striped table-hover align-middle mb-0">
              <thead>
                <tr>
                  {ordenavelAgora && <th style={{ width: 1 }}>{tx('Ordem')}</th>}
                  {def.colunas.map((c, i) => <th key={i} className={c.tipo ? 'col-imagem' : ''}>{c.rotulo}</th>)}
                  <th>{tx('Estado')}</th>
                  {INTERATIVAS.includes(colecao) && <th className="text-nowrap text-center" title={tx('Visualizações · Gostos · Comentários')}><i className="fa fa-eye" /> · <i className="fa fa-heart" /> · <i className="fa fa-comment" /></th>}
                  {publicidade && <><th className="text-end">{tx('Impressões')}</th><th className="text-end">{tx('Cliques')}</th><th className="text-end" title={tx('Taxa de cliques')}>{tx('CTR')}</th></>}
                  <th className="text-end" style={{ width: 1 }}>{tx('Ações')}</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.length === 0 && (
                  <tr><td colSpan={12} className="text-center text-muted py-4">{termo || estado ? tx('Nada corresponde aos filtros.') : tx('Ainda não há {0}.', { 0: def.titulo.toLowerCase() })}</td></tr>
                )}
                {visiveis.map((item) => {
                  const indice = itens.indexOf(item)
                  const est = item._estatisticas
                  const m = item._metricas
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
                      <td>
                        {item._estado === 'publicado'
                          ? <span className="badge bg-success">{publicidade && item.ativo === false ? tx('Publicado · inativo') : tx('Publicado')}</span>
                          : <span className="badge bg-warning text-dark">{tx('Rascunho')}</span>}
                        {item._editadoPor && <div className="small text-muted text-nowrap">{item._editadoPor}</div>}
                      </td>
                      {INTERATIVAS.includes(colecao) && (
                        <td className="text-center text-nowrap text-muted">{est ? `${est.visualizacoes} · ${est.gostos} · ${est.comentarios}` : '0 · 0 · 0'}</td>
                      )}
                      {publicidade && (
                        <>
                          <td className="text-end">{m.impressoes.toLocaleString(localAtual())}</td>
                          <td className="text-end">{m.cliques.toLocaleString(localAtual())}</td>
                          <td className="text-end">{m.impressoes ? `${((m.cliques / m.impressoes) * 100).toFixed(1)}%` : '—'}</td>
                        </>
                      )}
                      <td className="text-end text-nowrap">
                        {def.rotaSite && item._estado === 'publicado' && (
                          <a href={`${SITE}${def.rotaSite(item)}`} target="_blank" rel="noreferrer" className="btn btn-sm btn-white me-1" title={tx('Ver no site')}><i className="fa fa-external-link-alt" /></a>
                        )}
                        <Link to={`/colecao/${colecao}/${item[def.chave]}`} className="btn btn-sm btn-primary me-1" title={tx('Abrir')}><i className="fa fa-pencil-alt" /></Link>
                        {podeApagar && <button className="btn btn-sm btn-danger" onClick={() => pedirApagar(item)} title={tx('Apagar')}><i className="fa fa-trash-alt" /></button>}
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
            <span className="text-muted small">{filtrados.length} {tx('resultados')}</span>
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
