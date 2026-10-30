import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { COLECOES } from '../esquemas'
import { Aviso, CabecalhoPagina, Carregando, Erro, Painel } from '../componentes/Ui'
import { PreVisualizacao } from '../editor/Laterais'
import { dataHora } from '../formatar'
import { t as tx } from '../../i18n/linguas'

// os campos que mudam numa alteração (pelos nomes do formulário)
function camposAlterados(p) {
  if (!p.publicados) return []
  const def = COLECOES[p.colecao]
  const rotulo = (k) => def?.campos?.find((c) => c.nome === k)?.rotulo || k
  return Object.keys({ ...p.publicados, ...p.dados }).filter((k) => !k.startsWith('_') && JSON.stringify(p.publicados[k]) !== JSON.stringify(p.dados[k])).map(rotulo)
}

/*
  Publicações à espera do Comandante: notícias, artigos, eventos, revistas, banners, cursos, pessoas e páginas
  do site que alguém quer publicar ou alterar. Pré-visualizar mostra como fica no site; numa alteração, o site
  continua com a versão aprovada até se decidir. Recusar pede o motivo, que quem escreveu vê no editor.
*/
function Publicacoes() {
  const [lista, setLista] = useState(null)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState(null)
  const [previa, setPrevia] = useState(null)
  const [recusar, setRecusar] = useState(null) // { p, motivo }
  const carregar = useCallback(() => api('/publicacoes').then((r) => { setErro(''); setLista(r) }).catch((e) => setErro(e.message)), [])
  useEffect(() => { carregar() }, [carregar])

  async function decidir(p, decisao, motivo) {
    try {
      await api(`/publicacoes/${p.colecao}/${encodeURIComponent(p.id)}/decisao`, { metodo: 'POST', corpo: { decisao, ...(motivo ? { motivo } : {}) } })
      setAviso({ texto: decisao === 'aprovar' ? tx('«{0}» aprovado: já está no site.', { 0: p.titulo }) : tx('«{0}» recusado. Quem o escreveu vê o motivo no editor.', { 0: p.titulo }) })
      setRecusar(null)
      carregar()
      window.dispatchEvent(new Event('esg-publicacoes'))
    } catch (e) {
      setAviso({ tipo: 'erro', texto: e.message })
    }
  }

  return (
    <>
      <CabecalhoPagina titulo={tx('Publicações por aprovar')} subtitulo={tx('nada chega ao site sem a aprovação do Comandante')} migalhas={[{ rotulo: tx('Publicações por aprovar') }]} />
      {erro && <Erro texto={erro} onRepetir={carregar} />}
      {!lista && !erro && <Carregando />}
      {lista?.length === 0 && <div className="alert alert-success"><i className="fa fa-check-circle me-2" />{tx('Não há publicações à espera de aprovação.')}</div>}
      {lista?.map((p) => {
        const def = COLECOES[p.colecao]
        const mudam = camposAlterados(p)
        return (
          <Painel key={`${p.colecao}/${p.id}`} titulo={<>{p.tipo === 'alterar' ? <span className="badge bg-warning text-dark me-2">{tx('Alteração')}</span> : <span className="badge bg-info me-2">{tx('Nova publicação')}</span>}{def?.singular ? tx(def.singular).replace(/^./, (c) => c.toUpperCase()) : tx('Página do site')}</>}>
            <div className="d-flex flex-wrap gap-3 align-items-start">
              {def?.documento?.capa && p.dados[def.documento.capa] && <img src={p.dados[def.documento.capa]} alt="" style={{ width: 160, height: 100, objectFit: 'cover', borderRadius: 8 }} />}
              <div className="flex-grow-1" style={{ minWidth: 240 }}>
                <h4 className="mb-1">{p.titulo || tx('Sem título')}</h4>
                {def?.documento?.entrada && p.dados[def.documento.entrada] && <p className="text-muted mb-2">{p.dados[def.documento.entrada]}</p>}
                <div className="small text-muted">{tx('Pedido por {0}, {1}.', { 0: p.pedidoPor || '—', 1: dataHora(p.pedidoEm) })}</div>
                {p.tipo === 'alterar' && <div className="small mt-1"><b>{tx('O que muda:')}</b> {mudam.length ? mudam.join(', ') : tx('(sem diferenças visíveis)')} <span className="text-muted">— {tx('o site mostra a versão aprovada até decidir.')}</span></div>}
              </div>
              <div className="d-flex flex-wrap gap-2">
                {def?.documento && <button type="button" className="btn btn-white" onClick={() => setPrevia({ item: p.dados, doc: def.documento })}><i className="fa fa-eye me-1" />{tx('Pré-visualizar')}</button>}
                <button type="button" className="btn btn-success" onClick={() => decidir(p, 'aprovar')}><i className="fa fa-check me-1" />{tx('Aprovar e publicar')}</button>
                <button type="button" className="btn btn-danger" onClick={() => setRecusar({ p, motivo: '' })}><i className="fa fa-times me-1" />{tx('Recusar')}</button>
              </div>
            </div>
            {recusar?.p === p && (
              <div className="d-flex flex-wrap gap-2 mt-3">
                <input className="form-control flex-grow-1" style={{ minWidth: 240 }} autoFocus value={recusar.motivo} onChange={(e) => setRecusar({ ...recusar, motivo: e.target.value })} placeholder={tx('Motivo da recusa (quem escreveu vê-o no editor)')} aria-label={tx('Motivo da recusa')} />
                <button type="button" className="btn btn-danger" disabled={recusar.motivo.trim().length < 3} onClick={() => decidir(p, 'recusar', recusar.motivo.trim())}>{tx('Confirmar recusa')}</button>
                <button type="button" className="btn btn-white" onClick={() => setRecusar(null)}>{tx('Cancelar')}</button>
              </div>
            )}
          </Painel>
        )
      })}
      {previa && <PreVisualizacao item={previa.item} doc={previa.doc} onFechar={() => setPrevia(null)} />}
      <Aviso aviso={aviso} onFechar={() => setAviso(null)} />
    </>
  )
}

export default Publicacoes
