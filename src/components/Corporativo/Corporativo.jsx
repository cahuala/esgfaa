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

const dataLegivel = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d || '') ? formatarDataLonga(d) : d)

// imagem em cima, etiqueta, título e data
export function Cartao({ para, imagem, etiqueta, titulo, resumo, data, elevado = false, className = '' }) {
  const texto = (
    <>
      {etiqueta && <div><Etiqueta>{etiqueta}</Etiqueta></div>}
      <h3 className={s.cartaoTitulo}>{titulo}</h3>
      {resumo && <p className={s.cartaoResumo}>{resumo}</p>}
      {data && <span className={s.cartaoData}>{dataLegivel(data)}</span>}
    </>
  )
  return (
    <Link to={para} className={`${s.cartao} ${elevado ? s.elevado : ''} ${className}`}>
      {imagem && <span className={s.cartaoImagem}><img src={imagem} alt="" loading="lazy" /></span>}
      {elevado ? <div className={s.corpo}>{texto}</div> : texto}
    </Link>
  )
}

// imagem à esquerda e texto à direita (listagens)
export function CartaoLista({ para, imagem, etiqueta, titulo, resumo, data, extra }) {
  return (
    <Link to={para} className={s.lista}>
      <span className={s.cartaoImagem}>{imagem && <img src={imagem} alt="" loading="lazy" />}</span>
      <div className={s.texto}>
        {etiqueta && <div><Etiqueta>{etiqueta}</Etiqueta></div>}
        <h3 className={s.cartaoTitulo}>{titulo}</h3>
        {resumo && <p className={s.cartaoResumo}>{resumo}</p>}
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

