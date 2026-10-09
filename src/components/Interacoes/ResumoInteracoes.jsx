import { FaHeart, FaRegComment } from 'react-icons/fa'
import { useConteudo } from '../../conteudo/contexto'
import styles from './Interacoes.module.css'

// "♥ 12  💬 3" — contagens pequenas para listagens (só aparece se houver algo a mostrar)
function ResumoInteracoes({ colecao, id }) {
  const { online, estatisticasDe } = useConteudo()
  const { gostos, comentarios } = estatisticasDe(colecao, id)
  if (!online || (!gostos && !comentarios)) return null

  return (
    <span className={styles.resumo}>
      {gostos > 0 && <span title="Gostos"><FaHeart aria-hidden="true" /> {gostos}</span>}
      {comentarios > 0 && <span title="Comentários"><FaRegComment aria-hidden="true" /> {comentarios}</span>}
    </span>
  )
}

export default ResumoInteracoes
