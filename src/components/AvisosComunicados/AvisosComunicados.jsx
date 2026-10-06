
import { Link } from 'react-router-dom'
import styles from './AvisosComunicados.module.css'

const avisos = [
  {
    id: 1,
    tipo: 'Alteração de calendário',
    data: '2026-09-25',
    titulo: 'Novas datas para os exames do 1.º semestre',
    resumo: 'O período de exames foi reajustado. Consulte o calendário académico atualizado.',
    importante: true,
  },
  {
    id: 2,
    tipo: 'Convocatória',
    data: '2026-09-22',
    titulo: 'Convocatória para reunião do corpo docente',
    resumo: 'Convocam-se todos os docentes para a reunião geral de preparação do novo semestre.',
    importante: false,
  },
  {
    id: 3,
    tipo: 'Comunicado',
    data: '2026-09-18',
    titulo: 'Abertura do período de candidaturas aos cursos',
    resumo: 'Estão abertas as candidaturas para o próximo ano letivo. Consulte os requisitos de admissão.',
    importante: false,
  },
  {
    id: 4,
    tipo: 'Aviso',
    data: '2026-09-10',
    titulo: 'Condicionamento de acesso às instalações',
    resumo: 'Durante as obras no bloco B, o acesso será feito exclusivamente pela entrada principal.',
    importante: false,
  },
]

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

// converte "2026-09-25" em Date local (evita problemas de fuso horário do new Date(string))
function paraData(iso) {
  const [ano, mes, dia] = iso.split('-').map(Number)
  return new Date(ano, mes - 1, dia)
}

function formatarData(iso) {
  const d = paraData(iso)
  return `${String(d.getDate()).padStart(2, '0')} ${MESES[d.getMonth()]} ${d.getFullYear()}`
}

function AvisosComunicados() {
  const ordenados = [...avisos]
    .sort((a, b) => paraData(b.data) - paraData(a.data))
    .slice(0, 5)

  return (
    <section className={styles.secao}>
      <div className={styles.container}>
        <div className={styles.cabecalho}>
          <div>
            <span className={styles.etiqueta}>Informação oficial</span>
            <h2>Avisos e comunicados</h2>
          </div>
          <Link to="/Comunicados" className={styles.verTodos}>Ver todos →</Link>
        </div>

        {ordenados.length === 0 ? (
          <p className={styles.vazio}>Não há comunicados publicados neste momento.</p>
        ) : (
          <ul className={styles.lista}>
            {ordenados.map((a) => (
              <li key={a.id}>
                <Link
                  to={`/Comunicados/${a.id}`}
                  className={`${styles.item} ${a.importante ? styles.importante : ''}`}
                >
                  <div className={styles.topoItem}>
                    <span className={styles.tipo}>{a.tipo}</span>
                    {a.importante && <span className={styles.selo}>Importante</span>}
                    <span className={styles.data}>{formatarData(a.data)}</span>
                  </div>
                  <h3>{a.titulo}</h3>
                  <p>{a.resumo}</p>
                  <span className={styles.ler}>Ler comunicado →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

export default AvisosComunicados