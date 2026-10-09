import { Link, useParams } from 'react-router-dom'
import CabecalhoPagina from '../../components/CabecalhoPagina/CabecalhoPagina'
import ConteudoRico from '../../components/ConteudoRico/ConteudoRico'
import Partilhar from '../../components/Partilhar/Partilhar'
import BarraLeitura from '../../components/BarraLeitura/BarraLeitura'
import NaoEncontrado from '../NaoEncontrado/NaoEncontrado'
import CartaoNoticia from './CartaoNoticia'
import noticias, { noticiaPorSlug } from '../../data/noticias'
import { formatarDataLonga } from '../../utils/datas'
import { tempoLeitura } from '../../utils/texto'
import pagina from '../../styles/pagina.module.css'
import styles from './Noticias.module.css'

function NoticiaDetalhe() {
  const { slug } = useParams()
  const noticia = noticiaPorSlug(slug)

  if (!noticia) {
    return <NaoEncontrado titulo="Notícia não encontrada" voltarPara="/Noticias" voltarTexto="Ver todas as notícias" />
  }

  // primeiro as da mesma categoria, depois as mais recentes
  const relacionadas = noticias
    .filter((n) => n.slug !== noticia.slug)
    .sort((a, b) => (b.categoria === noticia.categoria) - (a.categoria === noticia.categoria))
    .slice(0, 3)

  return (
    <main>
      <BarraLeitura />

      <CabecalhoPagina
        etiqueta={noticia.categoria}
        titulo={noticia.titulo}
        descricao={noticia.resumo}
        imagem={noticia.capa}
        migalhas={[{ label: 'Notícias', to: '/Noticias' }, { label: noticia.categoria }]}
      >
        <div className={styles.metaCabecalho}>
          <span>{noticia.autor}</span>
          <span aria-hidden="true">·</span>
          <time dateTime={noticia.data}>{formatarDataLonga(noticia.data)}</time>
          <span aria-hidden="true">·</span>
          <span>{tempoLeitura(noticia.conteudo)} min de leitura</span>
        </div>
      </CabecalhoPagina>

      <article className={pagina.secao}>
        <ConteudoRico blocos={noticia.conteudo} centrado />

        <footer className={styles.rodapeArtigo}>
          <Partilhar titulo={noticia.titulo} />
          <Link to="/Noticias" className={styles.voltar}>← Todas as notícias</Link>
        </footer>
      </article>

      {relacionadas.length > 0 && (
        <section className={`${pagina.secao} ${pagina.secaoAlt}`}>
          <div className={pagina.container}>
            <span className={pagina.etiqueta}>Continue a ler</span>
            <h2 className={pagina.tituloSecao}>Outras notícias</h2>
            <div className={`${styles.grelha} ${styles.grelhaRelacionadas}`}>
              {relacionadas.map((n) => <CartaoNoticia key={n.slug} noticia={n} />)}
            </div>
          </div>
        </section>
      )}
    </main>
  )
}

export default NoticiaDetalhe
