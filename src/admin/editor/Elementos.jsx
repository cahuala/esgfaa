import { useEffect, useRef, useState } from 'react'

// textarea que cresce com o texto (título, entrada, legendas)
export function TextoAuto({ valor, onChange, className, placeholder, maxLength }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [valor])
  return (
    <textarea
      ref={ref}
      rows={1}
      className={className}
      placeholder={placeholder}
      value={valor || ''}
      maxLength={maxLength}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

// zona para escolher ou arrastar ficheiros
export function ZonaFicheiro({ aceitar, multiplos, onFicheiros, abrirJa, children, className = '' }) {
  const entrada = useRef(null)
  const [sobre, setSobre] = useState(false)

  // abre logo o seletor de ficheiros quando o elemento acaba de ser inserido
  useEffect(() => {
    if (abrirJa) entrada.current?.click()
  }, [abrirJa])

  return (
    <div
      className={`doc-zona ${sobre ? 'doc-zona-sobre' : ''} ${className}`}
      // o clique do próprio input (disparado abaixo) sobe até aqui: ignora-o para não reabrir o seletor
      onClick={(e) => { if (e.target !== entrada.current) entrada.current.click() }}
      onDragOver={(e) => { e.preventDefault(); setSobre(true) }}
      onDragLeave={() => setSobre(false)}
      onDrop={(e) => { e.preventDefault(); setSobre(false); if (e.dataTransfer.files.length) onFicheiros(e.dataTransfer.files) }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && entrada.current.click()}
    >
      {children}
      <input ref={entrada} type="file" accept={aceitar} multiple={multiplos} hidden onChange={(e) => { if (e.target.files.length) onFicheiros(e.target.files); e.target.value = '' }} />
    </div>
  )
}
