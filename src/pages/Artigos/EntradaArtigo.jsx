import { Link } from 'react-router-dom'
import { pessoaPorId } from '../../data/pessoas'
import { formatarData } from '../../utils/datas'
import { iniciais, tempoLeitura } from '../../utils/texto'
import pagina from '../../styles/pagina.module.css'
import styles from './Artigos.module.css'

// Uma linha do índice de artigos
function EntradaArtigo({ artigo }) {
  const autor = pessoaPorId(artigo.autor)

  return (
    <Link to={`/Artigos/${artigo.slug}`} className={styles.entrada}>
      <div className={styles.entradaLado}>
        <span className={styles.tipo}>{artigo.tipo}</span>
        <time dateTime={artigo.data}>{formatarData(artigo.data)}</time>
      </div>

      <div className={styles.entradaCorpo}>
        <h3>{artigo.titulo}</h3>
        <p>{artigo.resumo}</p>
        <div className={styles.entradaRodape}>
          {autor && (
            <span className={styles.autorMini}>
              <span className={`${pagina.avatar} ${styles.avatarMini}`}>
                {autor.foto ? <img src={autor.foto} alt="" /> : iniciais(autor.nome)}
              </span>
              {autor.nome}
            </span>
          )}
          <span className={styles.ponto} aria-hidden="true">·</span>
          <span>{artigo.area}</span>
          <span className={styles.ponto} aria-hidden="true">·</span>
          <span>{tempoLeitura(artigo.conteudo)} min</span>
        </div>
      </div>

      <span className={styles.seta} aria-hidden="true">→</span>
    </Link>
  )
}

export default EntradaArtigo
