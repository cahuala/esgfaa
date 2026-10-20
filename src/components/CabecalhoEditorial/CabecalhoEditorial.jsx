import { Link, useLocation } from 'react-router-dom'
import { useConteudo } from '../../conteudo/contexto'
import { imagemTopo } from './imagensTopo'
import styles from './CabecalhoEditorial.module.css'
import { t } from '../../i18n/linguas'

/*
  Topo das páginas interiores, como no modelo corporativo: fotografia da secção (escolhida no painel, em
  «Imagens do topo») com um véu escuro, e por cima as migalhas, o rótulo, o título e o texto de entrada.
  `children` aparece à direita (ex.: números). `migalhas`: [{ label, to }] — o último item é a página atual.
  `faixa`: só a fotografia e o nome da secção (nas páginas de uma notícia ou de um evento, que têm o seu título).
*/
function CabecalhoEditorial({ migalhas, sobretitulo, titulo, entrada, imagem, faixa = false, children }) {
  const { pathname } = useLocation()
  const { paginas } = useConteudo() ?? {}
  const fundo = imagem || imagemTopo(pathname, paginas?.cabecalhos)
  return (
    <header className={`${styles.cabecalho} ${faixa ? styles.faixa : ''}`}>
      <div className={styles.fundo} style={{ backgroundImage: `url("${fundo}")` }} aria-hidden="true" />
      <div className={styles.veu} aria-hidden="true" />
      <div className={`contentor ${styles.interior}`}>
        <div className={styles.texto}>
          {migalhas && (
            <nav aria-label={t('Localização')} className={styles.migalhas}>
              <Link to="/">{t('Início')}</Link>
              {migalhas.map((m) => (
                <span key={m.label}>
                  <span aria-hidden="true">/</span>
                  {m.to ? <Link to={m.to}>{m.label}</Link> : <span aria-current="page">{m.label}</span>}
                </span>
              ))}
            </nav>
          )}
          {sobretitulo && <span className={styles.sobretitulo}>{sobretitulo}</span>}
          {faixa
            ? <div className={styles.tituloFaixa}>{titulo}</div>
            : <h1 className={titulo.length > 40 ? styles.tituloLongo : ''}>{titulo}</h1>}
          {entrada && <p className={styles.entrada}>{entrada}</p>}
        </div>
        {children && <div className={styles.lado}>{children}</div>}
      </div>
    </header>
  )
}

export default CabecalhoEditorial
