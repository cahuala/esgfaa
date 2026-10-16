import { FaBullseye, FaEye, FaShieldAlt } from 'react-icons/fa'
import { useConteudo } from '../../conteudo/contexto'
import { LigacaoMais } from '../Corporativo/Corporativo'
import styles from './MissaoVisaoValores.module.css'
import { t } from '../../i18n/linguas'

const PILARES = [
  { id: 'missao', titulo: 'Missão', Icone: FaBullseye },
  { id: 'visao', titulo: 'Visão', Icone: FaEye },
  { id: 'valores', titulo: 'Valores', Icone: FaShieldAlt },
]

// texto à esquerda e fotografia à direita (como "Our Platform" no modelo)
function MissaoVisaoValores() {
  const { paginas } = useConteudo()
  const textos = paginas.home.missao

  return (
    <section className="seccao">
      <div className={`contentor ${styles.grelha}`}>
        <div>
          <span className={styles.rotulo}>{t('A Escola')}</span>
          <h2>{t('Missão, visão e valores')}</h2>
          <ul className={styles.pilares}>
            {PILARES.map(({ id, titulo, Icone }) => (
              <li key={id}>
                <span className={styles.icone}><Icone aria-hidden="true" /></span>
                <div>
                  <h3>{t(titulo)}</h3>
                  <p>{textos[id]}</p>
                </div>
              </li>
            ))}
          </ul>
          <LigacaoMais para="/Institucional">{t('Conhecer a instituição')}</LigacaoMais>
        </div>
        {textos.imagem && <img className={styles.imagem} src={textos.imagem} alt="" loading="lazy" />}
      </div>
    </section>
  )
}

export default MissaoVisaoValores
