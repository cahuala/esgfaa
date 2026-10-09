import { Link } from 'react-router-dom'
import styles from './CabecalhoPagina.module.css'

/*
  Cabeçalho das páginas interiores, no mesmo estilo do hero da página inicial:
  foto de fundo com gradiente, passa por baixo da navbar.
  `migalhas`: [{ label, to }] — o último item é a página atual (sem link).
*/
function CabecalhoPagina({ etiqueta, titulo, descricao, imagem, migalhas = [], compacto = false, children }) {
  const fundo = imagem
    ? { backgroundImage: `linear-gradient(to top, rgba(10, 5, 3, 0.98) 0%, rgba(10, 5, 3, 0.82) 45%, rgba(10, 5, 3, 0.6) 100%), url("${imagem}")` }
    : undefined

  return (
    <header className={`${styles.cabecalho} ${compacto ? styles.compacto : ''}`} style={fundo}>
      <div className={styles.conteudo}>
        {migalhas.length > 0 && (
          <nav className={styles.migalhas} aria-label="Localização">
            <Link to="/">Início</Link>
            {migalhas.map((m) => (
              <span key={m.label}>
                <span className={styles.separador} aria-hidden="true">/</span>
                {m.to ? <Link to={m.to}>{m.label}</Link> : <span aria-current="page">{m.label}</span>}
              </span>
            ))}
          </nav>
        )}

        {etiqueta && <span className={styles.etiqueta}>{etiqueta}</span>}
        <h1>{titulo}</h1>
        {descricao && <p className={styles.descricao}>{descricao}</p>}
        {children}
      </div>
    </header>
  )
}

export default CabecalhoPagina
