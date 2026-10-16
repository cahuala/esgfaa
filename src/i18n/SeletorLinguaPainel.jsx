import { useEffect, useRef, useState } from 'react'
import { LINGUAS, linguaAtual, mudarLingua, t } from './linguas'

// escolha da língua no portal e no painel (barra de topo do Color Admin)
function SeletorLinguaPainel() {
  const [aberto, setAberto] = useState(false)
  const raiz = useRef(null)
  useEffect(() => {
    if (!aberto) return undefined
    const fora = (e) => { if (!raiz.current?.contains(e.target)) setAberto(false) }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [aberto])
  const atual = LINGUAS.find((l) => l.codigo === linguaAtual())
  return (
    <div className="navbar-item dropdown" ref={raiz}>
      <button type="button" className="navbar-link icon border-0 bg-transparent d-flex align-items-center gap-1" onClick={() => setAberto(!aberto)} aria-haspopup="listbox" aria-expanded={aberto} title={t('Mudar a língua')} aria-label={t('Língua: {nome}', { nome: atual.nome })}>
        <i className="fa fa-language" /><span className="fw-bold fs-12px">{atual.curto}</span>
      </button>
      {aberto && (
        <div className="dropdown-menu dropdown-menu-end show" style={{ position: 'absolute', right: 0, top: '100%' }} role="listbox" aria-label={t('Línguas')}>
          {LINGUAS.map((l) => (
            <button key={l.codigo} type="button" role="option" aria-selected={l.codigo === atual.codigo} lang={l.codigo} className={`dropdown-item d-flex gap-2 ${l.codigo === atual.codigo ? 'active' : ''}`} onClick={() => { setAberto(false); if (l.codigo !== atual.codigo) mudarLingua(l.codigo) }}>
              <b style={{ width: 24 }}>{l.curto}</b>{l.nome}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default SeletorLinguaPainel
