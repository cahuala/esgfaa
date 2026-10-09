
import styles from './CorpoDestaque.module.css'
import { useConteudo } from '../../conteudo/contexto'
import { iniciais } from '../../utils/texto'

function CorpoDestaque() {
  const { pessoas, paginas } = useConteudo()
  const textos = paginas.home.corpo
  // duplica a lista para o loop do carrossel ficar contínuo, sem salto visível
  const pessoasDuplicadas = [...pessoas, ...pessoas]

  return (
    <section className={styles.secao}>
      <div className={styles.cabecalho}>
        <span className={styles.etiqueta}>{textos.etiqueta}</span>
        <h2>{textos.titulo}</h2>
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