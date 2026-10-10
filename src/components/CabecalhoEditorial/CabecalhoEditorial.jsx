import { Link } from 'react-router-dom'
import styles from './CabecalhoEditorial.module.css'

/*
  Cabeçalho das páginas interiores sem fotografia: faixa cinzenta clara com migalhas,
  rótulo, título e texto de entrada. `children` aparece à direita (ex.: números).
  `migalhas`: [{ label, to }] — o último item é a página atual.
*/
function CabecalhoEditorial({ migalhas, sobretitulo, titulo, entrada, children }) {
  return (
    <header className={styles.cabecalho}>
      <div className={`contentor ${styles.interior}`}>
        <div className={styles.texto}>
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
          {sobretitulo && <span className={styles.sobretitulo}>{sobretitulo}</span>}
          <h1 className={titulo.length > 40 ? styles.tituloLongo : ''}>{titulo}</h1>
          {entrada && <p className={styles.entrada}>{entrada}</p>}
        </div>
        {children && <div className={styles.lado}>{children}</div>}
      </div>
    </header>
  )
}

export default CabecalhoEditorial
