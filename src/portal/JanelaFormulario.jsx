import { useEffect } from 'react'
import { t as tx } from '../i18n/linguas'

// janela (modal) para os formulários do portal que aparecem ao clicar; fecha com Esc ou no fundo
export default function JanelaFormulario({ titulo, aoFechar, children, larga = false }) {
  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape') aoFechar() }
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [aoFechar])
  return (
    <>
      <div className="modal d-block p-sem-impressao" tabIndex={-1} role="dialog" aria-modal="true" aria-label={titulo} onMouseDown={(e) => { if (e.target === e.currentTarget) aoFechar() }}>
        <div className={`modal-dialog modal-dialog-centered modal-dialog-scrollable${larga ? ' modal-lg' : ''}`}>
          <div className="modal-content">
            <div className="modal-header"><h4 className="modal-title">{titulo}</h4><button type="button" className="btn-close" onClick={aoFechar} aria-label={tx('Fechar')} /></div>
            <div className="modal-body">{children}</div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show p-sem-impressao" />
    </>
  )
}
