import { Link } from 'react-router-dom'
import CabecalhoEditorial from '../../components/CabecalhoEditorial/CabecalhoEditorial'
import { useConteudo } from '../../conteudo/contexto'
import { mensagensDosComandantes, nomeCompleto, paragrafos } from '../../components/MensagemComandante/comandantes'
import { t } from '../../i18n/linguas'
import styles from './Comandantes.module.css'

// as mensagens do Comandante actual (por inteiro) e dos comandantes que já passaram pela Escola
function Mensagem({ m, actual = false }) {
  return (
    <article className={`${styles.mensagem} ${actual ? styles.actual : ''}`} id={actual ? 'actual' : undefined}>
      <div className={styles.lado}>
        {m.foto ? <img src={m.foto} alt={nomeCompleto(m)} loading="lazy" /> : <div className={styles.semFoto} aria-hidden="true" />}
        <strong>{nomeCompleto(m)}</strong>
        <span>{t('Comandante')}{m.periodo ? ` · ${m.periodo}` : ''}</span>
      </div>
      <div className={styles.texto}>
        {paragrafos(m.mensagem).map((p) => <p key={p.slice(0, 40)}>{p}</p>)}
      </div>
    </article>
  )
}

function Comandantes() {
  const { paginas } = useConteudo()
  const { titulo, actual, anteriores } = mensagensDosComandantes(paginas)
  return (
    <>
      <CabecalhoEditorial migalhas={[{ label: t(titulo) }]} sobretitulo={t('Escola Superior de Guerra')} titulo={t('Mensagens dos Comandantes')} />
      <div className={`contentor ${styles.corpo}`}>
        {!actual && <p>{t('Ainda não há mensagens publicadas.')} <Link to="/">{t('Voltar à página inicial')}</Link></p>}
        {actual && (
          <section>
            <h2>{t('Comandante da Escola')}</h2>
            <Mensagem m={actual} actual />
          </section>
        )}
        {anteriores.length > 0 && (
          <section>
            <h2>{t('Comandantes anteriores')}</h2>
            {anteriores.map((m, i) => <Mensagem key={`${m.nome}-${i}`} m={m} />)}
          </section>
        )}
      </div>
    </>
  )
}

export default Comandantes
