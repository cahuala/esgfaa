/*
  Prepara o corpo de uma notícia/artigo/evento para o editor em modo documento:
  - converte os blocos antigos (parágrafo, subtítulo, lista) em texto formatado;
  - junta blocos de texto seguidos num só (escreve-se como num documento);
  - dá a cada bloco um _id estável (só existe no editor; retira-se ao guardar).
*/

const escapar = (t = '') => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

let contador = 0
export const novoId = () => `b${Date.now().toString(36)}${(contador++).toString(36)}`

function emHtml(bloco) {
  switch (bloco.tipo) {
    case 'paragrafo': return bloco.texto ? `<p>${escapar(bloco.texto)}</p>` : ''
    case 'subtitulo': return bloco.texto ? `<h2>${escapar(bloco.texto)}</h2>` : ''
    case 'lista': {
      const tag = bloco.ordenada ? 'ol' : 'ul'
      return `<${tag}>${(bloco.itens || []).map((i) => `<li>${escapar(i)}</li>`).join('')}</${tag}>`
    }
    case 'texto': return bloco.html || ''
    default: return null
  }
}

// texto vazio do Quill ("<p><br></p>")
export const htmlVazio = (html) => !String(html || '').replace(/<p><br><\/p>|<p>\s*<\/p>|\s/g, '')

export function prepararCorpo(blocos = []) {
  const resultado = []
  for (const b of blocos) {
    const html = emHtml(b)
    if (html !== null) {
      const ultimo = resultado[resultado.length - 1]
      if (ultimo?.tipo === 'texto') ultimo.html = `${ultimo.html}${html}`
      else resultado.push({ _id: novoId(), tipo: 'texto', html })
    } else {
      resultado.push({ ...b, _id: b._id || novoId() })
    }
  }
  // um documento começa sempre com um bloco de texto onde escrever
  if (!resultado.length || resultado[0].tipo !== 'texto') resultado.unshift({ _id: novoId(), tipo: 'texto', html: '' })
  return resultado
}

// para guardar: sem _id e sem blocos de texto vazios
export function limparCorpo(blocos = []) {
  return blocos
    .filter((b) => b.tipo !== 'texto' || !htmlVazio(b.html))
    .map(({ _id, ...resto }) => { void _id; return resto })
}

// estatísticas do texto para a coluna lateral
export function medirCorpo(blocos = [], extra = '') {
  const texto = blocos.map((b) => (b.tipo === 'texto' ? (b.html || '').replace(/<[^>]+>/g, ' ') : [b.texto, b.titulo, b.legenda].filter(Boolean).join(' '))).join(' ')
  const palavras = `${extra} ${texto}`.split(/\s+/).filter(Boolean).length
  const imagens = blocos.reduce((n, b) => n + (b.tipo === 'imagem' ? 1 : b.tipo === 'galeria' ? (b.imagens || []).length : 0), 0)
  return { palavras, minutos: Math.max(1, Math.round(palavras / 200)), imagens, videos: blocos.filter((b) => b.tipo === 'video').length }
}
