import { Link } from 'react-router-dom'
import { FaMapMarkerAlt } from 'react-icons/fa'
import ResumoInteracoes from '../../components/Interacoes/ResumoInteracoes'
import { diaDaSemana, diaDoMes, mesCurto } from '../../utils/datas'
import styles from './Eventos.module.css'

// Uma entrada da agenda: data em grande, hora, título e local
function LinhaAgenda({ evento, realizado = false }) {
  return (
    <Link to={`/Eventos/${evento.id}`} className={`${styles.linha} ${realizado ? styles.linhaRealizada : ''}`}>
      <span className={styles.linhaData}>
        <strong>{diaDoMes(evento.data)}</strong>
        <span>{mesCurto(evento.data)}</span>
        <small>{diaDaSemana(evento.data)}</small>
      </span>
      <span className={styles.linhaHora}>
        {evento.horaInicio}
        {evento.horaFim && <small>até {evento.horaFim}</small>}
      </span>
      <span className={styles.linhaCorpo}>
        <span className={styles.linhaTipo}>
          {evento.categoria}
          {evento.inscricoes && !realizado && <em>Inscrições abertas</em>}
        </span>
        <span className={styles.linhaTitulo}>{evento.titulo}</span>
        <span className={styles.linhaLocal}>
          <FaMapMarkerAlt aria-hidden="true" /> {evento.local}
          <ResumoInteracoes colecao="eventos" id={evento.id} />
        </span>
      </span>
      <span className={styles.linhaFoto}>
        <img src={evento.capa} alt="" loading="lazy" />
      </span>
    </Link>
  )
}

export default LinhaAgenda
