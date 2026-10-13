import { useEffect } from 'react'
import { FaCircleNotch, FaExclamationTriangle } from 'react-icons/fa'

// peças comuns do portal

export function Titulo({ rotulo, titulo, children }) {
  return (
    <div className="p-titulo">
      <div>
        {rotulo && <span className="p-rotulo">{rotulo}</span>}
        <h1>{titulo}</h1>
      </div>
      {children && <div className="p-titulo-acoes">{children}</div>}
    </div>
  )
}

export function Cartao({ titulo, acoes, children, className = '' }) {
  return (
    <section className={`p-cartao ${className}`}>
      {(titulo || acoes) && (
        <header className="p-cartao-cabeca">
          {titulo && <h2>{titulo}</h2>}
          {acoes}
        </header>
      )}
      <div className="p-cartao-corpo">{children}</div>
    </section>
  )
}

export function Carregando({ texto = 'A carregar…' }) {
  return <p className="p-carregando"><FaCircleNotch className="p-roda" aria-hidden="true" /> {texto}</p>
}

export function Erro({ texto, onRepetir }) {
  return (
    <div className="p-erro" role="alert">
      <FaExclamationTriangle aria-hidden="true" /> <span>{texto}</span>
      {onRepetir && <button type="button" className="p-botao p-botao-contorno p-botao-pequeno" onClick={onRepetir}>Tentar de novo</button>}
    </div>
  )
}

export function Vazio({ children }) {
  return <p className="p-vazio">{children}</p>
}

// mensagem temporária no canto (guardado, enviado, …)
export function Aviso({ aviso, onFechar }) {
  useEffect(() => {
    if (!aviso) return undefined
    const t = setTimeout(onFechar, 4500)
    return () => clearTimeout(t)
  }, [aviso, onFechar])
  if (!aviso) return null
  return (
    <div className={`p-aviso ${aviso.tipo === 'erro' ? 'p-aviso-erro' : ''}`} role="status">
      {aviso.texto}
      <button type="button" onClick={onFechar} aria-label="Fechar">×</button>
    </div>
  )
}

export function Etiqueta({ cor = 'cinzento', children }) {
  return <span className={`p-etiqueta p-${cor}`}>{children}</span>
}

// campo de formulário com rótulo e erro
export function Campo({ id, rotulo, erro, ajuda, largo, children }) {
  return (
    <div className={`p-campo ${largo ? 'p-largo' : ''} ${erro ? 'p-com-erro' : ''}`}>
      <label htmlFor={id}>{rotulo}</label>
      {children}
      {erro ? <span className="p-campo-erro" role="alert">{erro}</span> : ajuda && <span className="p-campo-ajuda">{ajuda}</span>}
    </div>
  )
}
