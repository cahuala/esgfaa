import { Link } from 'react-router-dom'
import { useConteudo } from '../../conteudo/contexto'
import styles from './CtaBanner.module.css'

function CTABanner() {
  const { cta } = useConteudo().paginas.home
  return (
    <section className={styles.faixa}>
      <div className={`contentor ${styles.grelha}`}>
        <div>
          <h2>{cta.titulo}</h2>
          <p>{cta.texto}</p>
        </div>
        <Link to="/#candidatura" className={styles.botao}>{cta.botao} <span aria-hidden="true">→</span></Link>
      </div>
    </section>
  )
}

export default CTABanner
