import { useEffect, useRef, useState } from 'react'
import { useIdioma } from '../../i18n/contexto'
import { LINGUAS, t } from '../../i18n/linguas'
import styles from './SeletorLingua.module.css'

// escolha da língua do site (PT, EN, FR, ES), no cabeçalho
function SeletorLingua() {
  const { lingua, mudar } = useIdioma()
  const [aberto, setAberto] = useState(false)
  const raiz = useRef(null)
  useEffect(() => {
    if (!aberto) return undefined
    const fora = (e) => { if (!raiz.current?.contains(e.target)) setAberto(false) }
    const tecla = (e) => { if (e.key === 'Escape') setAberto(false) }
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', tecla)
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', tecla) }
  }, [aberto])
  const atual = LINGUAS.find((l) => l.codigo === lingua)
  return (
    <div className={styles.raiz} ref={raiz}>
      <button type="button" className={styles.botao} onClick={() => setAberto(!aberto)} aria-haspopup="listbox" aria-expanded={aberto} aria-label={t('Língua: {nome}', { nome: atual.nome })} title={t('Mudar a língua')}>
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" /></svg>
        <span>{atual.curto}</span>
      </button>
      {aberto && (
        <ul className={styles.lista} role="listbox" aria-label={t('Línguas')}>
          {LINGUAS.map((l) => (
            <li key={l.codigo}>
              <button type="button" role="option" aria-selected={l.codigo === lingua} lang={l.codigo} className={l.codigo === lingua ? styles.ativa : ''} onClick={() => { setAberto(false); if (l.codigo !== lingua) mudar(l.codigo) }}>
                <b>{l.curto}</b>{l.nome}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default SeletorLingua
