import { Link } from 'react-router-dom'
import ed from '../../styles/editorial.module.css'
import styles from './NaoEncontrado.module.css'

function NaoEncontrado({
  titulo = 'Página não encontrada',
  voltarPara = '/',
  voltarTexto = 'Voltar ao início',
}) {
  return (
    <main className={`contentor ${styles.pagina}`}>
      <span className={styles.codigo}>Erro 404</span>
      <h1>{titulo}</h1>
      <p>A ligação pode estar errada ou o conteúdo pode ter sido removido.</p>
      <div className={styles.acoes}>
        <Link to={voltarPara} className={ed.botao}>{voltarTexto}</Link>
        {voltarPara !== '/' && <Link to="/" className={`${ed.botao} ${ed.botaoContorno}`}>Página inicial</Link>}
      </div>
    </main>
  )
}

export default NaoEncontrado
