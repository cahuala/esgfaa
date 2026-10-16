import { useEffect } from 'react'
import ConteudoRico from '../../components/ConteudoRico/ConteudoRico'
import { Painel } from '../componentes/Ui'
import { limparCorpo, medirCorpo } from './normalizar'
import { t as tx, localAtual } from '../../i18n/linguas'

// ---------- texto: palavras, leitura, imagens ----------

export function PainelTexto({ item, doc }) {
  const m = medirCorpo(item[doc.corpo], `${item[doc.titulo] || ''} ${item[doc.entrada] || ''}`)
  return (
    <Painel titulo={tx('Texto')}>
      <div className="doc-medidas">
        <div><strong>{m.palavras.toLocaleString(localAtual())}</strong><span>{tx('palavras')}</span></div>
        <div><strong>{m.minutos}</strong><span>{tx('min de leitura')}</span></div>
        <div><strong>{m.imagens}</strong><span>{tx('imagens')}</span></div>
        <div><strong>{m.videos}</strong><span>{tx('vídeos')}</span></div>
      </div>
    </Painel>
  )
}

// ---------- como aparece nos resultados do Google ----------

export function PainelGoogle({ item, doc, endereco }) {
  const titulo = item[doc.titulo] || tx('Título da notícia')
  const resumo = item[doc.entrada] || tx('A entrada da notícia aparece aqui, como descrição nos resultados de pesquisa.')
  const corte = (t, n) => (t.length > n ? `${t.slice(0, n - 1)}…` : t)
  return (
    <Painel titulo={tx('Pré-visualização no Google')}>
      <div className="doc-google">
        <span className="doc-google-url">{tx('cahuala.github.io › esgfaa ›')} {endereco}</span>
        <span className="doc-google-titulo">{corte(titulo, 62)} {tx('— ESG')}</span>
        <span className="doc-google-texto">{corte(resumo, 158)}</span>
      </div>
      <div className="small text-muted mt-2">
        {tx('Título:')} <b className={titulo.length > 62 ? 'text-danger' : ''}>{titulo.length}</b>{tx('/62 · Entrada:')} <b className={resumo.length > 158 ? 'text-danger' : ''}>{(item[doc.entrada] || '').length}</b>{tx('/158 caracteres')}
      </div>
    </Painel>
  )
}

// ---------- pré-visualização com o aspeto do site ----------

export function PreVisualizacao({ item, doc, onFechar }) {
  useEffect(() => {
    const tecla = (e) => e.key === 'Escape' && onFechar()
    document.addEventListener('keydown', tecla)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', tecla)
      document.body.style.overflow = ''
    }
  }, [onFechar])

  return (
    <div className="doc-previa" role="dialog" aria-modal="true" aria-label={tx('Pré-visualização')}>
      <div className="doc-previa-barra">
        <span><i className="fa fa-eye me-2" />{tx('Pré-visualização — assim vai aparecer no site')}</span>
        <button type="button" className="btn btn-sm btn-white" onClick={onFechar}><i className="fa fa-times me-1" />{tx('Fechar')}</button>
      </div>
      <div className="doc-previa-pagina">
        <header className="doc-previa-cabecalho">
          <span className="doc-previa-linha"><span>{tx('Forças Armadas Angolanas')}</span><span>{tx('Estabelecimento de Ensino Superior Militar')}</span></span>
          {doc.etiqueta && <span className="doc-previa-seccao">{item[doc.etiqueta]}</span>}
          <h1>{item[doc.titulo] || tx('Sem título')}</h1>
          {doc.entrada && item[doc.entrada] && <p>{item[doc.entrada]}</p>}
        </header>
        {doc.capa && item[doc.capa] && <img className="doc-previa-capa" src={item[doc.capa]} alt="" />}
        <div className="doc-previa-corpo">
          <ConteudoRico blocos={limparCorpo(item[doc.corpo])} capitular />
        </div>
      </div>
    </div>
  )
}
