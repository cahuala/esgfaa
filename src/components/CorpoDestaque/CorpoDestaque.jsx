import { useConteudo } from '../../conteudo/contexto'
import { iniciais } from '../../utils/texto'
import { TituloSeccao } from '../Corporativo/Corporativo'
import styles from './CorpoDestaque.module.css'

// Comando e corpo docente
function CorpoDestaque() {
  const { pessoas, paginas } = useConteudo()
  const textos = paginas.home.corpo
  if (!pessoas.length) return null

  return (
    <section className="seccao seccao-cinza">
      <div className="contentor">
        <TituloSeccao rotulo={textos.etiqueta || 'Corpo docente'} titulo={textos.titulo} />
        <div className={styles.grelha}>
          {pessoas.map((p) => (
            <article className={styles.cartao} key={p.id}>
              <div className={styles.foto}>
                {p.foto ? <img src={p.foto} alt="" loading="lazy" /> : <span aria-hidden="true">{iniciais(p.nome)}</span>}
              </div>
              <div className={styles.corpo}>
                <h3>{p.nome}</h3>
                <span className={styles.cargo}>{p.cargo}</span>
                {p.destaque && <p>{p.destaque}</p>}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

export default CorpoDestaque
