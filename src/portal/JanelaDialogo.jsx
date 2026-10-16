import { useEffect, useRef, useState } from 'react'
import { registarDialogos } from './dialogos'
import { t as tx } from '../i18n/linguas'

// janela de confirmação / pergunta (modal do tema); fecha com Esc e confirma com Enter
function JanelaDialogo() {
  const [d, setD] = useState(null)
  const [valor, setValor] = useState('')
  const campo = useRef(null)
  const botao = useRef(null)
  useEffect(() => registarDialogos((novo) => { setValor(novo.valor ?? ''); setD(novo) }), [])
  useEffect(() => {
    if (!d) return undefined
    const t = setTimeout(() => (d.tipo === 'pedir' ? campo.current?.select() : botao.current?.focus()), 30)
    const tecla = (e) => { if (e.key === 'Escape') fechar(null) }
    document.addEventListener('keydown', tecla)
    return () => { clearTimeout(t); document.removeEventListener('keydown', tecla) }
  })
  if (!d) return null

  function fechar(resposta) {
    d.resolver(d.tipo === 'confirmar' ? resposta === true : resposta)
    setD(null)
  }
  const ok = () => fechar(d.tipo === 'confirmar' ? true : valor.trim() || (d.obrigatorio ? null : ''))
  const vazio = d.tipo === 'pedir' && d.obrigatorio && !valor.trim()

  return (
    <>
      <div className="modal d-block" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="dialogo-titulo" onClick={() => fechar(null)}>
        <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
          <form className="modal-content" onSubmit={(e) => { e.preventDefault(); if (!vazio) ok() }}>
            <div className="modal-header">
              <h4 className="modal-title" id="dialogo-titulo">
                {d.perigo && <i className="fa fa-exclamation-triangle text-danger me-2" />}{d.titulo}
              </h4>
              <button type="button" className="btn-close" onClick={() => fechar(null)} aria-label={tx('Fechar')} />
            </div>
            <div className="modal-body">
              {d.tipo === 'confirmar' ? <p className="mb-0">{d.texto}</p> : (
                <>
                  {d.titulo !== d.texto && <label className="form-label fw-bold" htmlFor="dialogo-campo">{d.texto}</label>}
                  {d.multilinha
                    ? <textarea id="dialogo-campo" ref={campo} className="form-control" rows={4} value={valor} onChange={(e) => setValor(e.target.value)} aria-label={d.texto} />
                    : <input id="dialogo-campo" ref={campo} className="form-control" value={valor} onChange={(e) => setValor(e.target.value)} aria-label={d.texto} />}
                </>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-white" onClick={() => fechar(null)}>{tx('Cancelar')}</button>
              <button type="submit" ref={botao} className={`btn ${d.perigo ? 'btn-danger' : 'btn-theme'}`} disabled={vazio}>{d.botao}</button>
            </div>
          </form>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  )
}

export default JanelaDialogo
