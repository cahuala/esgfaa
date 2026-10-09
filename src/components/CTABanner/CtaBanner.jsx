
import { Link } from 'react-router-dom'
import { useConteudo } from '../../conteudo/contexto'
import styles from './CtaBanner.module.css'

function CTABanner() {
  const { cta } = useConteudo().paginas.home

  return (
    <section className={styles.secao}>
      <div className={styles.container}>
        <h2>{cta.titulo}</h2>
        <p>{cta.texto}</p>
        <Link to="/#candidatura" className={styles.botao}>{cta.botao}</Link>
      </div>
    </section>
  )
}

export default CTABanner