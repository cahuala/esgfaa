import { Link } from 'react-router-dom'
import { formatarData } from '../../utils/datas'
import styles from './Noticias.module.css'

// Notícia em formato pequeno: coluna de arquivo e barras laterais
function Miniatura({ noticia }) {
  return (
    <Link to={`/Noticias/${noticia.slug}`} className={styles.miniatura}>
      <span className={styles.miniaturaFoto}>
        <img src={noticia.capa} alt="" loading="lazy" />
      </span>
      <span className={styles.miniaturaTexto}>
        <span className={styles.miniaturaMeta}>
          {noticia.categoria} · <time dateTime={noticia.data}>{formatarData(noticia.data)}</time>
        </span>
        <span className={styles.miniaturaTitulo}>{noticia.titulo}</span>
      </span>
    </Link>
  )
}

export default Miniatura
