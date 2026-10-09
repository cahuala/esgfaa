
import styles from './CorpoDestaque.module.css'
import pessoas from '../../data/pessoas'
import { iniciais } from '../../utils/texto'

function CorpoDestaque() {
  // duplica a lista para o loop do carrossel ficar contínuo, sem salto visível
  const pessoasDuplicadas = [...pessoas, ...pessoas]

  return (
    <section className={styles.secao}>
      <div className={styles.cabecalho}>
        <span className={styles.etiqueta}>Comando e Corpo Docente</span>
        <h2>Quem forma, também lidera.</h2>
      </div>

      <div className={styles.pista}>
        <div className={styles.trilho}>
          {pessoasDuplicadas.map((p, index) => (
            <div className={styles.cartao} key={`${p.id}-${index}`}>
              <div className={styles.fotoWrapper}>
                {p.foto ? (
                  <img src={p.foto} alt={p.nome} className={styles.foto} />
                ) : (
                  <span className={styles.iniciais} aria-hidden="true">{iniciais(p.nome)}</span>
                )}
              </div>
              <h3>{p.nome}</h3>
              <span className={styles.cargo}>{p.cargo}</span>
              <p>{p.destaque}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default CorpoDestaque