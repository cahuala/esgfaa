import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { useSessao } from '../sessaoContexto'
import { COLECOES } from '../esquemas'
import { Aviso, CabecalhoPagina, Carregando, Confirmar, Erro, Painel } from '../componentes/Ui'
import { dataHora } from '../formatar'
import { t as tx } from '../../i18n/linguas'

const SITE = import.meta.env.BASE_URL.replace(/\/$/, '')
const ROTULOS = { noticias: tx('Notícia'), eventos: tx('Evento'), artigos: tx('Artigo') }

function Comentarios() {
  const { pode } = useSessao()
  const [lista, setLista] = useState(null)
  const [erro, setErro] = useState('')
  const [filtro, setFiltro] = useState('')
  const [pesquisa, setPesquisa] = useState('')
  const [confirmar, setConfirmar] = useState(null)
  const [aviso, setAviso] = useState(null)

  const carregar = useCallback(() => {
    api('/comentarios').then((r) => { setErro(''); setLista(r) }).catch((e) => setErro(e.message))
  }, [])
  useEffect(carregar, [carregar])

  const termo = pesquisa.trim().toLowerCase()
  const visiveis = (lista || []).filter((c) =>
    (!filtro || c.colecao === filtro)
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
      <CabecalhoPagina titulo={tx('Comentários')} subtitulo={tx('publicados pelos visitantes')} migalhas={[{ rotulo: tx('Comentários') }]} />
      <div className="alert alert-info py-2">
        <i className="fa fa-info-circle me-2" />{tx('Os comentários são publicados de imediato. Apague aqui os que forem ofensivos, publicidade ou fora do tema.')}
      </div>
      {erro && <Erro texto={erro} onRepetir={() => { setErro(''); carregar() }} />}

      <Painel titulo={tx('Todos os comentários{0}', { 0: lista ? ` (${lista.length})` : '' })} corpo={false}>
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
        </div>
        {!lista && !erro ? <Carregando /> : (
          <div className="table-responsive mt-3">
            <table className="table table-striped align-middle mb-0">
              <thead>
                <tr><th>{tx('Autor')}</th><th>{tx('Comentário')}</th><th>{tx('Em')}</th><th>{tx('Data')}</th><th className="text-end">{tx('Ações')}</th></tr>
              </thead>
              <tbody>
                {visiveis.length === 0 && <tr><td colSpan={5} className="text-center text-muted py-4">{tx('Sem comentários.')}</td></tr>}
                {visiveis.map((c) => (
                  <tr key={c.id}>
                    <td className="fw-bold text-nowrap">{c.nome}<div className="text-muted small fw-normal">{c.ip}</div></td>
                    <td className="texto-comentario">{c.texto}</td>
                    <td>
                      <span className="badge bg-gray-300 text-gray-800 me-1">{ROTULOS[c.colecao]}</span>
                      <a href={`${SITE}${COLECOES[c.colecao].rotaSite({ slug: c.item_id, id: c.item_id })}#comentarios`} target="_blank" rel="noreferrer">{c.tituloItem}</a>
                    </td>
                    <td className="text-nowrap">{dataHora(c.data)}</td>
                    <td className="text-end">{pode('comentarios.apagar') && <button className="btn btn-sm btn-danger" onClick={() => pedirApagar(c)} title={tx('Apagar')}><i className="fa fa-trash-alt" /></button>}</td>
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
