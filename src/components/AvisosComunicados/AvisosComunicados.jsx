
import { useConteudo } from '../../conteudo/contexto'
import styles from './AvisosComunicados.module.css'

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
  const { paginas } = useConteudo()
  const { etiqueta, titulo, lista } = paginas.home.avisos
  const ordenados = [...lista]
    .sort((a, b) => paraData(b.data) - paraData(a.data))
    .slice(0, 5)

  return (
    <section className={styles.secao}>
      <div className={styles.container}>
        <div className={styles.cabecalho}>
          <div>
            <span className={styles.etiqueta}>{etiqueta}</span>
            <h2>{titulo}</h2>
          </div>
        </div>

        {ordenados.length === 0 ? (
          <p className={styles.vazio}>Não há comunicados publicados neste momento.</p>
        ) : (
          <ul className={styles.lista}>
            {ordenados.map((a) => (
              <li key={`${a.data}-${a.titulo}`}>
                <article className={`${styles.item} ${a.importante ? styles.importante : ''}`}>
                  <div className={styles.topoItem}>
                    <span className={styles.tipo}>{a.tipo}</span>
                    {a.importante && <span className={styles.selo}>Importante</span>}
                    <span className={styles.data}>{formatarData(a.data)}</span>
                  </div>
                  <h3>{a.titulo}</h3>
                  <p>{a.resumo}</p>
                </article>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

export default AvisosComunicados