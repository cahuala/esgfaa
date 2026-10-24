import { useConteudo } from '../../conteudo/contexto'
import { iniciais } from '../../utils/texto'
import styles from './CorpoDestaque.module.css'
import { t } from '../../i18n/linguas'

// Comando e corpo docente: cartões que vão passando (o rato por cima faz parar)
function CorpoDestaque() {
  const { pessoas, paginas } = useConteudo()
  const textos = paginas.home.corpo
  if (!pessoas.length) return null
  // a lista repete-se para a passagem ser contínua, sem salto
  const duplicadas = [...pessoas, ...pessoas]

  return (
    <section className={styles.secao}>
      <div className={`contentor ${styles.cabecalho}`}>
        <span className={styles.etiqueta}>{textos.etiqueta || t('Comando e corpo docente')}</span>
        <h2>{textos.titulo}</h2>
      </div>

      <div className={styles.pista}>
        <div className={styles.trilho}>
          {duplicadas.map((p, i) => (
            <div className={styles.cartao} key={`${p.id}-${i}`} aria-hidden={i >= pessoas.length || undefined}>
              <div className={styles.fotoWrapper}>
                {p.foto ? <img loading="lazy" decoding="async" src={p.foto} alt={i < pessoas.length ? p.nome : ''} className={styles.foto} /> : <span className={styles.iniciais} aria-hidden="true">{iniciais(p.nome)}</span>}
              </div>
              <h3>{p.nome}</h3>
              <span className={styles.cargo}>{p.cargo}</span>
              {p.destaque && <p>{p.destaque}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default CorpoDestaque
