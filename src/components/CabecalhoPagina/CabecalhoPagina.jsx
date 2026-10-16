import { Link } from 'react-router-dom'
import styles from './CabecalhoPagina.module.css'
import { t } from '../../i18n/linguas'

/*
  Cabeçalho das páginas interiores com fotografia (como o "Newsroom" do modelo):
  faixa com a imagem escurecida e o título em branco.
  `migalhas`: [{ label, to }] — o último item é a página atual (sem link).
*/
function CabecalhoPagina({ etiqueta, titulo, descricao, imagem, migalhas = [], compacto = false, children }) {
  return (
    <header className={`${styles.cabecalho} ${compacto ? styles.compacto : ''}`} style={imagem ? { backgroundImage: `url("${imagem}")` } : undefined}>
      <div className={styles.sombra} />
      <div className={`contentor ${styles.conteudo}`}>
        {migalhas.length > 0 && (
          <nav className={styles.migalhas} aria-label={t('Localização')}>
            <Link to="/">{t('Início')}</Link>
            {migalhas.map((m) => (
              <span key={m.label}>
                <span aria-hidden="true">/</span>
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
