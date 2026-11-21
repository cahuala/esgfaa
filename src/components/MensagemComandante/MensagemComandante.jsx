import { useConteudo } from '../../conteudo/contexto'
import { LigacaoMais } from '../Corporativo/Corporativo'
import { t } from '../../i18n/linguas'
import { mensagensDosComandantes, nomeCompleto, paragrafos } from './comandantes'
import styles from './MensagemComandante.module.css'

// página inicial: a mensagem do Comandante actual (resumida) e a ligação para as dos comandantes anteriores
function MensagemComandante() {
  const { paginas } = useConteudo()
  const { etiqueta, titulo, actual, anteriores } = mensagensDosComandantes(paginas)
  if (!actual) return null
  const texto = paragrafos(actual.mensagem)
  return (
    <section className="seccao">
      <div className={`contentor ${styles.grelha}`}>
        {actual.foto && <img className={styles.foto} src={actual.foto} alt={nomeCompleto(actual)} loading="lazy" />}
        <div>
          <span className={styles.rotulo}>{t(etiqueta)}</span>
          <h2>{t(titulo)}</h2>
          <blockquote className={styles.citacao}>
            {texto.slice(0, 2).map((p) => <p key={p.slice(0, 40)}>{p}</p>)}
          </blockquote>
          <p className={styles.assinatura}>
            <strong>{nomeCompleto(actual)}</strong>
            <span>{t('Comandante da Escola Superior de Guerra')}{actual.periodo ? ` · ${actual.periodo}` : ''}</span>
          </p>
          {(texto.length > 2 || anteriores.length > 0) && (
            <LigacaoMais para="/Comandantes">{anteriores.length ? t('Ler a mensagem completa e as dos comandantes anteriores') : t('Ler a mensagem completa')}</LigacaoMais>
          )}
        </div>
      </div>
    </section>
  )
}

export default MensagemComandante
