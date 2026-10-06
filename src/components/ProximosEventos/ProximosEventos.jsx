
import { Link } from 'react-router-dom'
import styles from './ProximosEventos.module.css'

const eventos = [
  {
    id: 1,
    data: '2026-10-08',
    hora: '09:00',
    categoria: 'Conferência',
    titulo: 'Conferência sobre Segurança e Defesa Regional',
    local: 'Auditório principal da Escola',
  },
  {
    id: 2,
    data: '2026-10-15',
    hora: '10:30',
    categoria: 'Cerimónia',
    titulo: 'Cerimónia de entrega de diplomas do Curso de Estado-Maior',
    local: 'Praça de armas da Escola',
  },
  {
    id: 3,
    data: '2026-10-22',
    hora: '14:00',
    categoria: 'Seminário',
    titulo: 'Seminário de Investigação Científica em Estratégia Militar',
    local: 'Sala de conferências, Bloco B',
  },
  {
    id: 4,
    data: '2026-11-05',
    hora: '09:30',
    categoria: 'Visita oficial',
    titulo: 'Visita de delegação de escola militar parceira',
    local: 'Instalações da Escola',
  },
]

const MESES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']

// converte "2026-10-08" em Date local (evita problemas de fuso horário do new Date(string))
function paraData(iso) {
  const [ano, mes, dia] = iso.split('-').map(Number)
  return new Date(ano, mes - 1, dia)
}

function ProximosEventos() {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

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
            <span className={styles.etiqueta}>Eventos</span>
            <h2>Próximos eventos</h2>
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
                    <span className={styles.dia}>{String(e._data.getDate()).padStart(2, '0')}</span>
                    <span className={styles.mes}>{MESES[e._data.getMonth()]}</span>
                  </div>

                  <div className={styles.corpo}>
                    <span className={styles.categoria}>{e.categoria}</span>
                    <h3>{e.titulo}</h3>
                    <div className={styles.meta}>
                      <span>🕒 {e.hora}</span>
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