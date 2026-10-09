import { Link } from 'react-router-dom'
import styles from './CabecalhoEditorial.module.css'

/*
  Cabeçalho das páginas interiores, ao estilo de um boletim oficial:
  linha institucional com filetes, migalhas opcionais, sobretítulo vermelho, título e,
  à direita, um texto de entrada ou um bloco de números.
  `migalhas`: [{ label, to }] — o último item é a página atual.
*/
function CabecalhoEditorial({ migalhas, sobretitulo, titulo, entrada, children }) {
  return (
    <header className={styles.cabecalho}>
      <div className={styles.interior}>
        {/* linha institucional, igual em todas as páginas */}
        <div className={styles.linhaTopo}>
          <span>Forças Armadas Angolanas</span>
          <span>Estabelecimento de Ensino Superior Militar</span>
        </div>

        {migalhas && (
          <nav aria-label="Localização" className={styles.migalhas}>
            <Link to="/">Início</Link>
            {migalhas.map((m) => (
              <span key={m.label}>
                <span aria-hidden="true">/</span>
                {m.to ? <Link to={m.to}>{m.label}</Link> : <span aria-current="page">{m.label}</span>}
              </span>
            ))}
          </nav>
        )}

        <div className={styles.titulo}>
          <div>
            {sobretitulo && <span className={styles.sobretitulo}>{sobretitulo}</span>}
            {/* títulos compridos (notícias, eventos, artigos) usam um corpo menor */}
            <h1 className={titulo.length > 34 ? styles.tituloLongo : ''}>{titulo}</h1>
          </div>
          {entrada && <p className={styles.entrada}>{entrada}</p>}
          {children}
        </div>
      </div>
    </header>
  )
}

export default CabecalhoEditorial
