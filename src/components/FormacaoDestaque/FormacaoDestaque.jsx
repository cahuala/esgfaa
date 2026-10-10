import { Link } from 'react-router-dom'
import { useConteudo } from '../../conteudo/contexto'
import { Etiqueta, TituloSeccao } from '../Corporativo/Corporativo'
import styles from './FormacaoDestaque.module.css'

// Cursos da Escola em cartões (título centrado, como "Our missions" no modelo)
function FormacaoDestaque() {
  const { cursos, paginas } = useConteudo()
  const textos = paginas.home.formacao
  if (!cursos.length) return null

  return (
    <section className="seccao">
      <div className="contentor">
        <TituloSeccao titulo={textos.titulo} texto={textos.texto} centrada />
        <div className={styles.grelha}>
          {cursos.map((c) => (
            <Link to={`/Cursos/${c.id}`} className={styles.cartao} key={c.id}>
              <span className={styles.imagem}>{c.imagem && <img src={c.imagem} alt="" loading="lazy" />}</span>
              <div className={styles.corpo}>
                <div className={styles.etiquetas}>
                  {c.duracao && <Etiqueta cor="cinzento">{c.duracao}</Etiqueta>}
                  {c.regime && <Etiqueta cor="azul">{c.regime}</Etiqueta>}
                </div>
                <h3>{c.nome}</h3>
                <p>{c.resumo}</p>
                <span className={styles.ligacao}>Conhecer o curso →</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

export default FormacaoDestaque
