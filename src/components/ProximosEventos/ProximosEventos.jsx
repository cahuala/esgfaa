
import { Link } from 'react-router-dom'
import { useConteudo } from '../../conteudo/contexto'
import { paraData, hoje as inicioDoDia, diaDoMes, mesCurto } from '../../utils/datas'
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
    <section className={styles.secao}>
      <div className={styles.container}>
        <div className={styles.cabecalho}>
          <div>
            <span className={styles.etiqueta}>{textos.etiqueta}</span>
            <h2>{textos.titulo}</h2>
          </div>
          <Link to="/Eventos" className={styles.verTodos}>Ver todos os eventos →</Link>
        </div>

        {proximos.length === 0 ? (
          <p className={styles.vazio}>Não há eventos agendados neste momento.</p>
        ) : (
          <ul className={styles.lista}>
            {proximos.map((e) => (
              <li key={e.id}>
                <Link to={`/Eventos/${e.id}`} className={styles.cartao}>
                  <div className={styles.dataBloco}>
                    <span className={styles.dia}>{diaDoMes(e.data)}</span>
                    <span className={styles.mes}>{mesCurto(e.data)}</span>
                  </div>

                  <div className={styles.corpo}>
                    <span className={styles.categoria}>{e.categoria}</span>
                    <h3>{e.titulo}</h3>
                    <div className={styles.meta}>
                      <span>🕒 {e.horaInicio}</span>
                      <span>📍 {e.local}</span>
                    </div>
                  </div>

                  <span className={styles.seta} aria-hidden="true">→</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

export default ProximosEventos