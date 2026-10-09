import { Link } from 'react-router-dom'
import { formatarData } from '../../utils/datas'
import { tempoLeitura } from '../../utils/texto'
import pagina from '../../styles/pagina.module.css'
import styles from './Noticias.module.css'

function CartaoNoticia({ noticia }) {
  return (
    <Link to={`/Noticias/${noticia.slug}`} className={styles.cartao}>
      <div className={styles.fotoWrapper}>
        <img src={noticia.capa} alt="" className={styles.foto} loading="lazy" />
        <span className={pagina.tagCategoria}>{noticia.categoria}</span>
      </div>
      <div className={styles.info}>
        <span className={styles.meta}>
          {formatarData(noticia.data)} · {tempoLeitura(noticia.conteudo)} min de leitura
        </span>
        <h3>{noticia.titulo}</h3>
        <p>{noticia.resumo}</p>
      </div>
    </Link>
  )
}

export default CartaoNoticia
