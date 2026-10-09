import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { COLECOES } from '../esquemas'
import { Aviso, CabecalhoPagina, Carregando, Confirmar, Erro, Painel } from '../componentes/Ui'
import { dataHora } from '../formatar'

const SITE = import.meta.env.BASE_URL.replace(/\/$/, '')
const ROTULOS = { noticias: 'Notícia', eventos: 'Evento', artigos: 'Artigo' }

function Comentarios() {
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
      titulo: 'Apagar comentário',
      texto: <>Apagar o comentário de <b>{c.nome}</b>? Deixa de aparecer no site e a ação fica registada.</>,
      botao: 'Apagar',
      perigo: true,
      confirmar: async () => {
        setConfirmar(null)
        try {
          await api(`/comentarios/${c.id}`, { metodo: 'DELETE' })
          setLista((l) => l.filter((x) => x.id !== c.id))
          setAviso({ texto: 'Comentário apagado.' })
        } catch (e) {
          setAviso({ tipo: 'erro', texto: e.message })
        }
      },
    })
  }

  return (
    <>
      <CabecalhoPagina titulo="Comentários" subtitulo="publicados pelos visitantes" migalhas={[{ rotulo: 'Comentários' }]} />
      <div className="alert alert-info py-2">
        <i className="fa fa-info-circle me-2" />Os comentários são publicados de imediato. Apague aqui os que forem ofensivos, publicidade ou fora do tema.
      </div>
      {erro && <Erro texto={erro} onRepetir={() => { setErro(''); carregar() }} />}

      <Painel titulo={`Todos os comentários${lista ? ` (${lista.length})` : ''}`} corpo={false}>
        <div className="panel-body d-flex gap-2 flex-wrap pb-0">
          <div className="input-group lista-pesquisa">
            <span className="input-group-text"><i className="fa fa-search" /></span>
            <input className="form-control" placeholder="Pesquisar nome ou texto…" value={pesquisa} onChange={(e) => setPesquisa(e.target.value)} />
          </div>
          <select className="form-select w-auto" value={filtro} onChange={(e) => setFiltro(e.target.value)}>
            <option value="">Todos os conteúdos</option>
            <option value="noticias">Notícias</option>
            <option value="eventos">Eventos</option>
            <option value="artigos">Artigos</option>
          </select>
        </div>
        {!lista && !erro ? <Carregando /> : (
          <div className="table-responsive mt-3">
            <table className="table table-striped align-middle mb-0">
              <thead>
                <tr><th>Autor</th><th>Comentário</th><th>Em</th><th>Data</th><th className="text-end">Ações</th></tr>
              </thead>
              <tbody>
                {visiveis.length === 0 && <tr><td colSpan={5} className="text-center text-muted py-4">Sem comentários.</td></tr>}
                {visiveis.map((c) => (
                  <tr key={c.id}>
                    <td className="fw-bold text-nowrap">{c.nome}<div className="text-muted small fw-normal">{c.ip}</div></td>
                    <td className="texto-comentario">{c.texto}</td>
                    <td>
                      <span className="badge bg-gray-300 text-gray-800 me-1">{ROTULOS[c.colecao]}</span>
                      <a href={`${SITE}${COLECOES[c.colecao].rotaSite({ slug: c.item_id, id: c.item_id })}#comentarios`} target="_blank" rel="noreferrer">{c.tituloItem}</a>
                    </td>
                    <td className="text-nowrap">{dataHora(c.data)}</td>
                    <td className="text-end"><button className="btn btn-sm btn-danger" onClick={() => pedirApagar(c)} title="Apagar"><i className="fa fa-trash-alt" /></button></td>
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
