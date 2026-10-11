import { Link } from 'react-router-dom'
import { FaArrowRight } from 'react-icons/fa'
import { useConteudo } from '../../conteudo/contexto'
import styles from './HeroSection.module.css'

// Abertura da página inicial: fotografia, título, números e um só convite à candidatura
function HeroSection() {
  const { paginas } = useConteudo()
  const hero = paginas.home.hero

  return (
    <section className={styles.hero} style={hero.imagem ? { backgroundImage: `url("${hero.imagem}")` } : undefined}>
      <div className={styles.sombra} />
      <div className={`contentor ${styles.grelha}`}>
        <div className={styles.texto}>
          <h1>{hero.titulo}</h1>
          <p>{hero.texto}</p>

          <div className={styles.metricas}>
            {hero.metricas.map((m) => (
              <div className={styles.metrica} key={m.legenda}>
                <strong>{m.valor}</strong>
                <span>{m.legenda}</span>
              </div>
            ))}
          </div>

          <div className={styles.acoes}>
            <Link to="/Candidatura" className={styles.botao}>Candidatar-me <span aria-hidden="true">→</span></Link>
            <Link to="/Cursos" className={styles.mais}>
              <span><FaArrowRight size={12} aria-hidden="true" /></span>
              Conhecer os cursos
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

export default HeroSection
