import { Link } from 'react-router-dom'
import { FaMapMarkerAlt, FaRegClock } from 'react-icons/fa'
import { useConteudo } from '../../conteudo/contexto'
import { paraData, hoje as inicioDoDia, diaDoMes, mesCurto } from '../../utils/datas'
import { Etiqueta, LigacaoMais, TituloSeccao } from '../Corporativo/Corporativo'
import styles from './ProximosEventos.module.css'

function ProximosEventos() {
  const { eventos, paginas } = useConteudo()
  const textos = paginas.home.eventos
  const hoje = inicioDoDia()

  const proximos = eventos
    .map((e) => ({ ...e, _data: paraData(e.data) }))
    .filter((e) => e._data >= hoje)
    .sort((a, b) => a._data - b._data)
    .slice(0, 4)

  return (
    <section className="seccao seccao-cinza">
      <div className="contentor">
        <TituloSeccao rotulo={textos.etiqueta || 'Agenda'} titulo={textos.titulo} />

        {proximos.length === 0 ? (
          <p className={styles.vazio}>Não há eventos agendados neste momento.</p>
        ) : (
          <ul className={styles.lista}>
            {proximos.map((e) => (
              <li key={e.id}>
                <Link to={`/Eventos/${e.id}`} className={styles.cartao}>
                  <div className={styles.data}>
                    <strong>{diaDoMes(e.data)}</strong>
                    <span>{mesCurto(e.data)}</span>
                  </div>
                  <div className={styles.corpo}>
                    <div><Etiqueta>{e.categoria}</Etiqueta></div>
                    <h3>{e.titulo}</h3>
                    <div className={styles.meta}>
                      {e.horaInicio && <span><FaRegClock aria-hidden="true" /> {e.horaInicio}</span>}
                      {e.local && <span><FaMapMarkerAlt aria-hidden="true" /> {e.local}</span>}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <div className={styles.rodape}>
          <LigacaoMais para="/Eventos">Ver todos os eventos</LigacaoMais>
        </div>
      </div>
    </section>
  )
}

export default ProximosEventos
