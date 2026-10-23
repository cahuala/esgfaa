import { Link } from 'react-router-dom'
import { FaArrowRight } from 'react-icons/fa'
import { corEtiqueta } from './etiquetas'
import { formatarDataLonga } from '../../utils/datas'
import s from './Corporativo.module.css'

// Peças comuns do site, no estilo do modelo "Corporate" do Color Admin

export function Etiqueta({ children, cor }) {
  if (!children) return null
  return <span className={`${s.etiqueta} ${s[cor || corEtiqueta(children)]}`}>{children}</span>
}

export function TituloSeccao({ rotulo, titulo, texto, centrada = false, nivel: Nivel = 'h2' }) {
  return (
    <div className={`${s.seccaoCabeca} ${centrada ? s.centrada : ''}`}>
      {rotulo && <span className={s.rotulo}>{rotulo}</span>}
      {titulo && <Nivel>{titulo}</Nivel>}
      {texto && <p>{texto}</p>}
    </div>
  )
}

/*
  Fotografia inteira dentro de uma moldura de proporção fixa: nada é cortado nem ampliado
  além do necessário; o espaço que sobra é preenchido pela mesma imagem, desfocada.
  (Os retratos ao alto deixam de aparecer recortados e "maiores que o lugar".)
*/
export function Foto({ src, alt = '', className = '', carregar = 'lazy' }) {
  return (
    <span className={`${s.moldura} ${className}`} style={src ? { '--foto': `url("${src}")` } : undefined}>
      {src && <img src={src} alt={alt} loading={carregar} />}
    </span>
  )
}

const dataLegivel = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d || '') ? formatarDataLonga(d) : d)

// imagem em cima, etiqueta, título e data
// o texto todo ao passar o rato, quando o cartão o corta com «…»
const dica = (t) => (typeof t === 'string' && t.length > 60 ? t : undefined)

export function Cartao({ para, imagem, etiqueta, titulo, resumo, data, elevado = false, className = '' }) {
  const texto = (
    <>
      {etiqueta && <div><Etiqueta>{etiqueta}</Etiqueta></div>}
      <h3 className={s.cartaoTitulo} title={dica(titulo)}>{titulo}</h3>
      {resumo && <p className={s.cartaoResumo} title={dica(resumo)}>{resumo}</p>}
      {data && <span className={s.cartaoData}>{dataLegivel(data)}</span>}
    </>
  )
  return (
    <Link to={para} className={`${s.cartao} ${elevado ? s.elevado : ''} ${className}`}>
      {imagem && <Foto src={imagem} className={s.cartaoImagem} />}
      {elevado ? <div className={s.corpo}>{texto}</div> : texto}
    </Link>
  )
}

// imagem à esquerda e texto à direita (listagens)
export function CartaoLista({ para, imagem, etiqueta, titulo, resumo, data, extra }) {
  return (
    <Link to={para} className={s.lista}>
      <Foto src={imagem} className={s.cartaoImagem} />
      <div className={s.texto}>
        {etiqueta && <div><Etiqueta>{etiqueta}</Etiqueta></div>}
        <h3 className={s.cartaoTitulo} title={dica(titulo)}>{titulo}</h3>
        {resumo && <p className={s.cartaoResumo} title={dica(resumo)}>{resumo}</p>}
        {extra}
        {data && <span className={s.cartaoData}>{dataLegivel(data)}</span>}
      </div>
    </Link>
  )
}

// "→ Ver todas as notícias"
export function LigacaoMais({ para, children, claro = false }) {
  return (
    <Link to={para} className={`${s.mais} ${claro ? s.claro : ''}`}>
      <span><FaArrowRight aria-hidden="true" size={12} /></span>
      {children}
    </Link>
  )
}

