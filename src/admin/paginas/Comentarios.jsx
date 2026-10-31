import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { useSessao } from '../sessaoContexto'
import { COLECOES } from '../esquemas'
import { Aviso, CabecalhoPagina, Carregando, Confirmar, Erro, Painel } from '../componentes/Ui'
import { dataHora } from '../formatar'
import Exportar from '../componentes/Exportar'
import { t as tx } from '../../i18n/linguas'

const SITE = import.meta.env.BASE_URL.replace(/\/$/, '')
const ROTULOS = { noticias: tx('Notícia'), eventos: tx('Evento'), artigos: tx('Artigo') }
// o caminho de cada comentário até ao site: equipa de comunicação → Comandante → publicado
const ESTADOS = {
  pendente: { rotulo: tx('Por rever'), cor: 'bg-warning text-dark' },
  revisto: { rotulo: tx('Com o Comandante'), cor: 'bg-info' },
  publicado: { rotulo: tx('Publicado'), cor: 'bg-success' },
}

function Comentarios() {
  const { pode } = useSessao()
  const [lista, setLista] = useState(null)
  const [erro, setErro] = useState('')
  const [filtro, setFiltro] = useState('')
  const [estado, setEstado] = useState(pode('comentarios.aprovar') ? 'pendente' : '')
  const [pesquisa, setPesquisa] = useState('')
  const [confirmar, setConfirmar] = useState(null)
  const [aviso, setAviso] = useState(null)

  const carregar = useCallback(() => {
    api('/comentarios').then((r) => { setErro(''); setLista(r) }).catch((e) => setErro(e.message))
  }, [])
  useEffect(carregar, [carregar])
  // os comentários novos aparecem sem recarregar
  useEffect(() => {
    window.addEventListener('esg-tempo-real', carregar)
    return () => window.removeEventListener('esg-tempo-real', carregar)
  }, [carregar])

  async function rever(c, decisao) {
    try {
      const r = await api(`/comentarios/${c.id}/revisao`, { metodo: 'POST', corpo: { decisao } })
      setLista((l) => (r.estado === 'recusado' ? l.filter((x) => x.id !== c.id) : l.map((x) => (x.id === c.id ? { ...x, estado: r.estado } : x))))
      setAviso({ texto: r.estado === 'recusado' ? tx('Comentário recusado (apagado).') : r.estado === 'publicado' ? tx('Comentário aprovado: já aparece no site.') : tx('Comentário aprovado: segue para o Comandante.') })
      window.dispatchEvent(new Event('esg-comentarios'))
    } catch (e) {
      setAviso({ tipo: 'erro', texto: e.message })
    }
  }

  function pedirRecusar(c) {
    setConfirmar({
      titulo: tx('Recusar comentário'),
      texto: <>{tx('Recusar o comentário de')} <b>{c.nome}</b>{tx('? Não chega ao site e é apagado (o texto fica no registo de atividades).')}</>,
      botao: tx('Recusar'),
      perigo: true,
      confirmar: () => { setConfirmar(null); rever(c, 'recusar') },
    })
  }

  const termo = pesquisa.trim().toLowerCase()
  const visiveis = (lista || []).filter((c) =>
    (!filtro || c.colecao === filtro)
    && (!estado || c.estado === estado)
    && (!termo || `${c.nome} ${c.texto} ${c.tituloItem}`.toLowerCase().includes(termo)))

  function pedirApagar(c) {
    setConfirmar({
      titulo: tx('Apagar comentário'),
      texto: <>{tx('Apagar o comentário de')} <b>{c.nome}</b>{tx('? Deixa de aparecer no site e a ação fica registada.')}</>,
      botao: tx('Apagar'),
      perigo: true,
      confirmar: async () => {
        setConfirmar(null)
        try {
          await api(`/comentarios/${c.id}`, { metodo: 'DELETE' })
          setLista((l) => l.filter((x) => x.id !== c.id))
          setAviso({ texto: tx('Comentário apagado.') })
        } catch (e) {
          setAviso({ tipo: 'erro', texto: e.message })
        }
      },
    })
  }

  return (
    <>
      <CabecalhoPagina titulo={tx('Comentários')} subtitulo={tx('dos visitantes do site')} migalhas={[{ rotulo: tx('Comentários') }]} />
      <div className="alert alert-info py-2">
        <i className="fa fa-info-circle me-2" />{tx('Um comentário só aparece no site depois de duas aprovações: primeiro a equipa de comunicação, aqui; depois o Comandante, em «Por aprovar». Recuse os ofensivos, publicidade ou fora do tema.')}
      </div>
      <ul className="nav nav-pills mb-3">
        {[['pendente', ESTADOS.pendente.rotulo], ['revisto', ESTADOS.revisto.rotulo], ['publicado', ESTADOS.publicado.rotulo], ['', tx('Todos')]].map(([id, rotulo]) => (
          <li key={id || 'todos'} className="nav-item">
            <button type="button" className={`nav-link ${estado === id ? 'active' : ''}`} onClick={() => setEstado(id)}>
              {rotulo}{id && lista ? <span className="badge bg-white text-dark ms-2">{lista.filter((c) => c.estado === id).length}</span> : null}
            </button>
          </li>
        ))}
      </ul>
      {erro && <Erro texto={erro} onRepetir={() => { setErro(''); carregar() }} />}

      <Painel titulo={`${estado ? ESTADOS[estado].rotulo : tx('Todos os comentários')} (${visiveis.length})`} corpo={false}>
        <div className="panel-body d-flex gap-2 flex-wrap pb-0">
          <div className="input-group lista-pesquisa">
            <span className="input-group-text"><i className="fa fa-search" /></span>
            <input className="form-control" placeholder={tx('Pesquisar nome ou texto…')} value={pesquisa} onChange={(e) => setPesquisa(e.target.value)} />
          </div>
          <select className="form-select w-auto" value={filtro} onChange={(e) => setFiltro(e.target.value)}>
            <option value="">{tx('Todos os conteúdos')}</option>
            <option value="noticias">{tx('Notícias')}</option>
            <option value="eventos">{tx('Eventos')}</option>
            <option value="artigos">{tx('Artigos')}</option>
          </select>
          <Exportar
            className="ms-auto align-self-center"
            titulo={tx('Comentários')}
            filtro={[filtro && ROTULOS[filtro], termo && tx('pesquisa: «{0}»', { 0: pesquisa.trim() })].filter(Boolean).join(' · ')}
            linhas={visiveis}
            colunas={[
              { titulo: tx('Autor'), valor: (c) => c.nome },
              { titulo: tx('Comentário'), valor: (c) => c.texto },
              { titulo: tx('Conteúdo'), valor: (c) => ROTULOS[c.colecao] },
              { titulo: tx('Título'), valor: (c) => c.tituloItem },
              { titulo: tx('Estado'), valor: (c) => ESTADOS[c.estado]?.rotulo },
              { titulo: tx('Data'), valor: (c) => dataHora(c.data) },
              { titulo: 'IP', valor: (c) => c.ip },
            ]}
          />
        </div>
        {!lista && !erro ? <Carregando /> : (
          <div className="table-responsive mt-3">
            <table className="table table-striped align-middle mb-0">
              <thead>
                <tr><th>{tx('Autor')}</th><th>{tx('Comentário')}</th><th>{tx('Em')}</th><th>{tx('Data')}</th><th className="text-end">{tx('Ações')}</th></tr>
              </thead>
              <tbody>
                {visiveis.length === 0 && <tr><td colSpan={5} className="text-center text-muted py-4">{estado === 'pendente' ? tx('Não há comentários por rever.') : tx('Sem comentários.')}</td></tr>}
                {visiveis.map((c) => (
                  <tr key={c.id}>
                    <td className="fw-bold text-nowrap">{c.nome}<div className="text-muted small fw-normal">{c.ip}</div></td>
                    <td className="texto-comentario">{c.texto}</td>
                    <td>
                      <span className="badge bg-gray-300 text-gray-800 me-1">{ROTULOS[c.colecao]}</span>
                      <a href={`${SITE}${COLECOES[c.colecao].rotaSite({ slug: c.item_id, id: c.item_id })}#comentarios`} target="_blank" rel="noreferrer">{c.tituloItem}</a>
                    </td>
                    <td className="text-nowrap">
                      {dataHora(c.data)}
                      <div><span className={`badge ${ESTADOS[c.estado]?.cor}`}>{ESTADOS[c.estado]?.rotulo}</span></div>
                      {c.revistoPor && <div className="text-muted small">{tx('Revisto por {0}', { 0: c.revistoPor })}</div>}
                    </td>
                    <td className="text-end text-nowrap">
                      {c.estado === 'pendente' && pode('comentarios.aprovar') && (
                        <>
                          <button className="btn btn-sm btn-success me-1" onClick={() => rever(c, 'aprovar')}><i className="fa fa-check me-1" />{tx('Aprovar')}</button>
                          <button className="btn btn-sm btn-warning me-1" onClick={() => pedirRecusar(c)}><i className="fa fa-times me-1" />{tx('Recusar')}</button>
                        </>
                      )}
                      {pode('comentarios.apagar') && <button className="btn btn-sm btn-danger" onClick={() => pedirApagar(c)} title={tx('Apagar')}><i className="fa fa-trash-alt" /></button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Painel>

      <Confirmar pedido={confirmar} onCancelar={() => setConfirmar(null)} />
      <Aviso aviso={aviso} onFechar={() => setAviso(null)} />
    </>
  )
}

export default Comentarios
