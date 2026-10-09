import { Link } from 'react-router-dom'
import { FaRegClock, FaMapMarkerAlt } from 'react-icons/fa'
import { diaDoMes, mesCurto } from '../../utils/datas'
import styles from './Eventos.module.css'

function LinhaEvento({ evento, realizado = false }) {
  return (
    <Link to={`/Eventos/${evento.id}`} className={`${styles.linha} ${realizado ? styles.linhaRealizada : ''}`}>
      <div className={styles.dataBloco}>
        <span className={styles.dia}>{diaDoMes(evento.data)}</span>
        <span className={styles.mes}>{mesCurto(evento.data)}</span>
      </div>

      <div className={styles.corpoLinha}>
        <div className={styles.topoLinha}>
          <span className={styles.categoria}>{evento.categoria}</span>
          {evento.inscricoes && !realizado && <span className={styles.selo}>Inscrições abertas</span>}
        </div>
        <h3>{evento.titulo}</h3>
        <div className={styles.metaLinha}>
          <span><FaRegClock aria-hidden="true" /> {evento.horaInicio}{evento.horaFim && ` – ${evento.horaFim}`}</span>
          <span><FaMapMarkerAlt aria-hidden="true" /> {evento.local}</span>
        </div>
      </div>

      <div className={styles.miniatura}>
        <img src={evento.capa} alt="" loading="lazy" />
      </div>
    </Link>
  )
}

export default LinhaEvento
