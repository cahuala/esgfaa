
import styles from './MissaoVisaoValores.module.css'
import LogoEscola from '../../assets/Logo.png'
import { useConteudo } from '../../conteudo/contexto'

const pilares = [
  {
    id: 'missao',
    titulo: 'Missão',
    icone: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    id: 'visao',
    titulo: 'Visão',
    icone: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z" />
        <circle cx="12" cy="12" r="2.6" />
      </svg>
    ),
  },
  {
    id: 'valores',
    titulo: 'Valores',
    icone: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M12 3l7 3v6c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V6l7-3Z" />
      </svg>
    ),
  },
]

function MissaoVisaoValores() {
  const { paginas } = useConteudo()
  const textos = paginas.home.missao

  return (
    <section className={styles.secao}>
      <div className={styles.fundo} style={textos.imagem ? { backgroundImage: `url("${textos.imagem}")` } : undefined}>
        <div className={styles.overlay} />

      

        <div className={styles.selo}>
          <img src={LogoEscola} alt="Escola Superior de Guerra" />
        </div>
      </div>

      <div className={styles.cartoes}>
        {pilares.map((p) => (
          <div className={styles.cartao} key={p.id}>
            <div className={styles.icone}>{p.icone}</div>
            <h3>{p.titulo}</h3>
            <p>{textos[p.id]}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

export default MissaoVisaoValores