import { Link } from 'react-router-dom'
import CabecalhoPagina from '../../components/CabecalhoPagina/CabecalhoPagina'
import pagina from '../../styles/pagina.module.css'
import styles from './NaoEncontrado.module.css'

function NaoEncontrado({
  titulo = 'Página não encontrada',
  voltarPara = '/',
  voltarTexto = 'Voltar ao início',
}) {
  return (
    <main>
      <CabecalhoPagina
        etiqueta="Erro 404"
        titulo={titulo}
        descricao="A ligação pode estar errada ou o conteúdo pode ter sido removido."
        compacto
      >
        <div className={styles.acoes}>
          <Link to={voltarPara} className={pagina.botao}>{voltarTexto}</Link>
          {voltarPara !== '/' && (
            <Link to="/" className={`${pagina.botao} ${pagina.botaoSecundario}`}>Página inicial</Link>
          )}
        </div>
      </CabecalhoPagina>
    </main>
  )
}

export default NaoEncontrado
