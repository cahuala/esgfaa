
import styles from './CtaBanner.module.css'

function CTABanner() {
  return (
    <section className={styles.secao}>
      <div className={styles.container}>
        <h2>Pronto para dar o próximo passo na sua carreira militar?</h2>
        <p>Candidate-se aos cursos da Escola Superior de Guerra e prepare-se para funções de comando e liderança.</p>
        <a href="#candidatura" className={styles.botao}>Candidatar-me agora</a>
      </div>
    </section>
  )
}

export default CTABanner