import { urlFoto } from './api'

// as fotografias vêm com a sessão; cada uma pede-se uma só vez (chave: pessoa + ficheiro)
const cache = new Map()
export function carregarFoto(pessoaId, fotoId) {
  const k = `${pessoaId}/${fotoId}`
  if (!cache.has(k)) cache.set(k, urlFoto(pessoaId).catch(() => null))
  return cache.get(k)
}

// a fotografia como data: URL (para pôr nos PDF)
export async function fotoBase64(pessoaId, fotoId) {
  if (!pessoaId || !fotoId) return null
  const url = await carregarFoto(pessoaId, fotoId)
  if (!url) return null
  return new Promise((ok) => {
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = img.width
      c.height = img.height
      c.getContext('2d').drawImage(img, 0, 0)
      ok(c.toDataURL('image/jpeg', 0.9))
    }
    img.onerror = () => ok(null)
    img.src = url
  })
}

// reduz a fotografia no navegador antes de a enviar (máx. 600 px, JPEG): tabelas e PDF mais leves
export function reduzirFoto(ficheiro, max = 600) {
  return new Promise((ok, falha) => {
    const img = new Image()
    const url = URL.createObjectURL(ficheiro)
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * k)
      c.height = Math.round(img.height * k)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      c.toBlob((b) => (b ? ok(new File([b], ficheiro.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' })) : falha(new Error('Não foi possível ler a imagem.'))), 'image/jpeg', 0.86)
    }
    img.onerror = () => { URL.revokeObjectURL(url); falha(new Error(`«${ficheiro.name}» não é uma imagem válida.`)) }
    img.src = url
  })
}
