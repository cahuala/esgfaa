
import { Link } from 'react-router-dom'
import styles from './NoticiaDestaque.module.css'
import noticias from '../../data/noticias'
import { formatarData } from '../../utils/datas'

function NoticiaDestaque() {
  const recentes = noticias.slice(0, 6)
  const noticiasDuplicadas = [...recentes, ...recentes]

  return (
    <section className={styles.secao}>
      <div className={styles.cabecalho}>
        <span className={styles.etiqueta}>Notícias</span>
        <h2>O que está a acontecer na Escola.</h2>
      </div>

      <div className={styles.pista}>
        <div className={styles.trilho}>
          {noticiasDuplicadas.map((n, index) => (
            <Link to={`/Noticias/${n.slug}`} className={styles.cartao} key={`${n.slug}-${index}`}>
              <div className={styles.fotoWrapper}>
                <img src={n.capa} alt={n.titulo} className={styles.foto} />
                <span className={styles.tagCategoria}>{n.categoria}</span>
              </div>
              <div className={styles.info}>
                <span className={styles.data}>{formatarData(n.data)}</span>
                <h3>{n.titulo}</h3>
                <p>{n.resumo}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

export default NoticiaDestaque