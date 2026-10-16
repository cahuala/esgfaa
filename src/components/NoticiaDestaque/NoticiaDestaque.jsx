import { useConteudo } from '../../conteudo/contexto'
import { Cartao, LigacaoMais, TituloSeccao } from '../Corporativo/Corporativo'
import styles from './NoticiaDestaque.module.css'
import { t } from '../../i18n/linguas'

// "Top Stories": duas notícias pequenas à esquerda e a principal em grande; depois as recentes em linha
function NoticiaDestaque() {
  const { noticias, paginas } = useConteudo()
  const textos = paginas.home.noticias
  const [principal, ...resto] = noticias
  if (!principal) return null
  const lado = resto.slice(0, 2)
  const recentes = resto.slice(2, 6)
  const props = (n) => ({ para: `/Noticias/${n.slug}`, imagem: n.capa, etiqueta: n.categoria, titulo: n.titulo, data: n.data })

  return (
    <section className="seccao">
      <div className="contentor">
        <TituloSeccao rotulo={textos.etiqueta || t('Notícias')} titulo={textos.titulo} />

        <div className={styles.destaques}>
          <div className={styles.coluna}>
            {lado.map((n) => <Cartao key={n.slug} {...props(n)} />)}
          </div>
          <Cartao {...props(principal)} resumo={principal.resumo} className={styles.principal} />
        </div>

        {recentes.length > 0 && (
          <>
            <span className={styles.rotulo}>{t('Mais recentes')}</span>
            <div className={styles.recentes}>
              {recentes.map((n) => <Cartao key={n.slug} {...props(n)} />)}
            </div>
          </>
        )}

        <div className={styles.rodape}>
          <LigacaoMais para="/Noticias">{t('Ver todas as notícias')}</LigacaoMais>
        </div>
      </div>
    </section>
  )
}

export default NoticiaDestaque
