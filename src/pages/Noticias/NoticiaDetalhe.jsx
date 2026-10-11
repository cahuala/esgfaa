import { Link, useParams } from 'react-router-dom'
import { FaArrowLeft, FaRegCalendar, FaRegClock, FaRegUser } from 'react-icons/fa'
import ConteudoRico from '../../components/ConteudoRico/ConteudoRico'
import Partilhar from '../../components/Partilhar/Partilhar'
import BarraLeitura from '../../components/BarraLeitura/BarraLeitura'
import NaoEncontrado from '../NaoEncontrado/NaoEncontrado'
import Publicidade from '../../components/Publicidade/Publicidade'
import Interacoes from '../../components/Interacoes/Interacoes'
import { Cartao, Etiqueta, Foto } from '../../components/Corporativo/Corporativo'
import { useConteudo } from '../../conteudo/contexto'
import { formatarDataLonga } from '../../utils/datas'
import { ancora, subtitulosDe, tempoLeitura } from '../../utils/texto'
import styles from './NoticiaDetalhe.module.css'

// Notícia completa, como o "news detail" do modelo Corporate
function NoticiaDetalhe() {
  const { slug } = useParams()
  const { noticias, noticiaPorSlug } = useConteudo()
  const noticia = noticiaPorSlug(slug)

  if (!noticia) {
    return <NaoEncontrado titulo="Notícia não encontrada" voltarPara="/Noticias" voltarTexto="Ver todas as notícias" />
  }

  const subtitulos = subtitulosDe(noticia.conteudo)
  const outras = noticias.filter((n) => n.slug !== noticia.slug)
  const destaques = outras.slice(0, 4)
  const mesmaSeccao = outras.filter((n) => n.categoria === noticia.categoria && !destaques.includes(n)).slice(0, 3)
  // da mesma secção primeiro; completa com outras até três
  const maisNoticias = [...mesmaSeccao, ...outras.filter((n) => !destaques.includes(n) && !mesmaSeccao.includes(n))].slice(0, 3)
  const seccoes = [...new Set(noticias.map((n) => n.categoria))]
  const minutos = tempoLeitura(noticia.conteudo)

  return (
    <main>
      <BarraLeitura />

      <div className={`contentor ${styles.grelha}`}>
        <article className={styles.principal}>
          <Link to="/Noticias" className={styles.voltar}>
            <span><FaArrowLeft aria-hidden="true" /></span> Voltar às notícias
          </Link>

          <Etiqueta>{noticia.categoria}</Etiqueta>
          <h1>{noticia.titulo}</h1>
          <p className={styles.entrada}>{noticia.resumo}</p>

          <div className={styles.meta}>
            {noticia.autor && <span><FaRegUser aria-hidden="true" /> {noticia.autor}</span>}
            <span><FaRegCalendar aria-hidden="true" /> <time dateTime={noticia.data}>{formatarDataLonga(noticia.data)}</time></span>
            <span><FaRegClock aria-hidden="true" /> {minutos} min de leitura</span>
          </div>

          <div className={styles.partilha}>
            <Partilhar titulo={noticia.titulo} />
          </div>

          {noticia.capa && (
            <figure className={styles.capa}>
              <Foto src={noticia.capa} className={styles.capaMoldura} carregar="eager" />
            </figure>
          )}

          {subtitulos.length > 1 && (
            <nav className={styles.indice} aria-label="Nesta notícia">
              <strong>Nesta notícia</strong>
              <ol>
                {subtitulos.map((s) => <li key={s}><a href={`#${ancora(s)}`}>{s}</a></li>)}
              </ol>
            </nav>
          )}

          <ConteudoRico blocos={noticia.conteudo} />

          <Publicidade posicao="noticia-fim" variante="embutido" />

          <Interacoes colecao="noticias" id={noticia.slug} titulo={noticia.titulo} />
        </article>

        <aside className={styles.lateral}>
          {destaques.length > 0 && (
            <section>
              <h2>Em destaque</h2>
              <div className={styles.destaques}>
                {destaques.map((n) => (
                  <Cartao key={n.slug} para={`/Noticias/${n.slug}`} imagem={n.capa} titulo={n.titulo} data={n.data} className={styles.pequeno} />
                ))}
              </div>
            </section>
          )}

          <section>
            <h2>Secções</h2>
            <ul className={styles.seccoes}>
              {seccoes.map((s) => <li key={s}><Link to="/Noticias">{s}</Link></li>)}
            </ul>
          </section>
        </aside>
      </div>

      {maisNoticias.length > 0 && (
        <section className={`seccao ${styles.mais}`}>
          <div className="contentor">
            <span className={styles.maisRotulo}>Mais notícias</span>
            <div className={styles.maisGrelha}>
              {maisNoticias.map((n) => (
                <Cartao key={n.slug} para={`/Noticias/${n.slug}`} imagem={n.capa} etiqueta={n.categoria} titulo={n.titulo} data={n.data} />
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  )
}

export default NoticiaDetalhe
