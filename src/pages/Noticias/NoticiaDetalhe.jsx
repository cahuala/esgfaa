import { Link, useParams } from 'react-router-dom'
import ConteudoRico from '../../components/ConteudoRico/ConteudoRico'
import Partilhar from '../../components/Partilhar/Partilhar'
import BarraLeitura from '../../components/BarraLeitura/BarraLeitura'
import NaoEncontrado from '../NaoEncontrado/NaoEncontrado'
import Miniatura from './Miniatura'
import Interacoes from '../../components/Interacoes/Interacoes'
import { useConteudo } from '../../conteudo/contexto'
import { formatarDataLonga } from '../../utils/datas'
import { ancora, tempoLeitura } from '../../utils/texto'
import lista from './Noticias.module.css'
import styles from './NoticiaDetalhe.module.css'

function NoticiaDetalhe() {
  const { slug } = useParams()
  const { noticias, noticiaPorSlug } = useConteudo()
  const noticia = noticiaPorSlug(slug)

  if (!noticia) {
    return <NaoEncontrado titulo="Notícia não encontrada" voltarPara="/Noticias" voltarTexto="Ver todas as notícias" />
  }

  const subtitulos = noticia.conteudo.filter((b) => b.tipo === 'subtitulo')
  const mesmaSeccao = noticias.filter((n) => n.slug !== noticia.slug && n.categoria === noticia.categoria).slice(0, 3)
  const anteriores = noticias
    .filter((n) => n.data < noticia.data && !mesmaSeccao.includes(n))
    .slice(0, 4)
  const minutos = tempoLeitura(noticia.conteudo)

  return (
    <main className={`${lista.pagina} ${styles.pagina}`}>
      <BarraLeitura />

      <header className={styles.cabecalho}>
        <div className={styles.cabecalhoInterior}>
          <nav className={styles.migalhas} aria-label="Localização">
            <Link to="/">Início</Link>
            <span aria-hidden="true">/</span>
            <Link to="/Noticias">Notícias</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{noticia.categoria}</span>
          </nav>

          <div className={styles.titulo}>
            <h1>{noticia.titulo}</h1>
            <div className={styles.entrada}>
              <span className={styles.seccao}>{noticia.categoria}</span>
              <p>{noticia.resumo}</p>
            </div>
          </div>
        </div>
      </header>

      <figure className={styles.capa}>
        <img src={noticia.capa} alt="" />
      </figure>

      <div className={styles.grelha}>
        {/* Coluna esquerda: ficha da notícia */}
        <aside className={styles.ficha}>
          <dl>
            <div><dt>Publicado</dt><dd><time dateTime={noticia.data}>{formatarDataLonga(noticia.data)}</time></dd></div>
            <div><dt>Autoria</dt><dd>{noticia.autor}</dd></div>
            <div><dt>Leitura</dt><dd>{minutos} {minutos === 1 ? 'minuto' : 'minutos'}</dd></div>
            <div><dt>Secção</dt><dd><Link to="/Noticias">{noticia.categoria}</Link></dd></div>
          </dl>

          {subtitulos.length > 0 && (
            <nav className={styles.indice} aria-label="Nesta notícia">
              <span className={lista.rotuloColuna}>Nesta notícia</span>
              <ol>
                {subtitulos.map((s) => (
                  <li key={s.texto}><a href={`#${ancora(s.texto)}`}>{s.texto}</a></li>
                ))}
              </ol>
            </nav>
          )}

          <div className={styles.partilha}>
            <Partilhar titulo={noticia.titulo} />
          </div>
        </aside>

        {/* Centro: texto com imagens paginadas */}
        <article className={styles.texto}>
          <ConteudoRico blocos={noticia.conteudo} capitular />

          <Interacoes colecao="noticias" id={noticia.slug} titulo={noticia.titulo} />

          <footer className={styles.fim}>
            <span className={styles.fimMarca} aria-hidden="true">■</span>
            <Link to="/Noticias" className={lista.lerMais}>Voltar ao boletim de notícias</Link>
          </footer>
        </article>

        {/* Direita: outras notícias em miniatura */}
        <aside className={lista.arquivo}>
          {mesmaSeccao.length > 0 && (
            <>
              <span className={lista.rotuloColuna}>Mesma secção</span>
              <h2 className={lista.arquivoTitulo}>{noticia.categoria}</h2>
              <div className={lista.arquivoGrupo}>
                {mesmaSeccao.map((n) => <Miniatura key={n.slug} noticia={n} />)}
              </div>
            </>
          )}

          {anteriores.length > 0 && (
            <div className={styles.anteriores}>
              <span className={lista.rotuloColuna}>Arquivo</span>
              <h2 className={lista.arquivoTitulo}>Notícias anteriores</h2>
              <div className={lista.arquivoGrupo}>
                {anteriores.map((n) => <Miniatura key={n.slug} noticia={n} />)}
              </div>
            </div>
          )}
        </aside>
      </div>
    </main>
  )
}

export default NoticiaDetalhe
