import { Link } from 'react-router-dom'
import { useConteudo } from '../../conteudo/contexto'
import ResumoInteracoes from '../../components/Interacoes/ResumoInteracoes'
import { formatarData } from '../../utils/datas'
import { tempoLeitura } from '../../utils/texto'
import { Etiqueta } from '../../components/Corporativo/Corporativo'
import styles from './Artigos.module.css'

// Uma entrada do índice de publicações
function EntradaArtigo({ artigo }) {
  const { pessoaPorId } = useConteudo()
  const autor = pessoaPorId(artigo.autor)

  return (
    <Link to={`/Artigos/${artigo.slug}`} className={styles.entrada}>
      <span className={styles.entradaCorpo}>
        <span className={styles.entradaTipo}>
          <Etiqueta>{artigo.tipo}</Etiqueta><span>{artigo.area}</span>
        </span>
        <span className={styles.entradaTitulo}>{artigo.titulo}</span>
        {autor && <span className={styles.entradaAutor}>{autor.nome}</span>}
        <span className={styles.entradaResumo}>{artigo.resumo}</span>
        <span className={styles.entradaRodape}>
          <time dateTime={artigo.data}>{formatarData(artigo.data)}</time>
          <span>{tempoLeitura(artigo.conteudo)} min de leitura</span>
          <ResumoInteracoes colecao="artigos" id={artigo.slug} />
          {artigo.palavrasChave.slice(0, 3).map((p) => <span key={p} className={styles.palavra}>{p}</span>)}
        </span>
      </span>
    </Link>
  )
}

export default EntradaArtigo
