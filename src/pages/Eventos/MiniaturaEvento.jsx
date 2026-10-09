import { Link } from 'react-router-dom'
import { formatarData } from '../../utils/datas'
import styles from './Eventos.module.css'

function MiniaturaEvento({ evento }) {
  return (
    <Link to={`/Eventos/${evento.id}`} className={styles.miniatura}>
      <span className={styles.miniaturaFoto}><img src={evento.capa} alt="" loading="lazy" /></span>
      <span>
        <span className={styles.miniaturaMeta}>{evento.categoria} · {formatarData(evento.data)}</span>
        <span className={styles.miniaturaTitulo}>{evento.titulo}</span>
      </span>
    </Link>
  )
}

export default MiniaturaEvento
