import { useEffect, useState } from 'react'
import { carregarFoto } from '../fotos'

/*
  Fotografia redonda (ou as iniciais, se não houver). Usada nas tabelas, no chat e no expediente.
  Recebe pessoaId e fotoId (o fotoId muda quando a fotografia muda).
*/
export default function Foto({ pessoaId, fotoId, nome = '', tamanho = 34 }) {
  const chave = pessoaId && fotoId ? `${pessoaId}/${fotoId}` : null
  const [r, setR] = useState({ chave: null, url: null })
  useEffect(() => {
    if (!chave) return undefined
    let vivo = true
    carregarFoto(pessoaId, fotoId).then((url) => { if (vivo) setR({ chave, url }) })
    return () => { vivo = false }
  }, [chave, pessoaId, fotoId])
  const url = r.chave === chave ? r.url : null
  const iniciais = nome.replace(/^(Prof\.ª?|[A-Z][a-z]*\.-?[A-Za-z.-]*)\s+/, '').split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
  const estilo = { width: tamanho, height: tamanho, fontSize: Math.round(tamanho * 0.38) }
  return url
    ? <img src={url} alt={nome ? `Fotografia de ${nome}` : ''} className="pes-avatar" style={estilo} loading="lazy" />
    : <span className="pes-avatar pes-avatar-vazio" style={estilo} aria-hidden="true">{iniciais || <i className="fa fa-user" />}</span>
}

