/*
  O corpo de uma notícia/artigo/evento é guardado como um único bloco de texto formatado
  ({ tipo: 'texto', html }), escrito no editor como num processador de texto.
  As imagens, galerias, vídeos e caixas de destaque vivem dentro do HTML, no ponto do texto
  onde o utilizador as colocou. Os conteúdos antigos (lista de blocos) são convertidos ao abrir.
*/

const escapar = (t = '') => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const LATERAIS = ['esquerda', 'direita']

export function figuraHtml({ src, legenda = '', posicao = 'centro', largura = null }) {
  const larg = largura || (LATERAIS.includes(posicao) ? 45 : null)
  const estilo = larg && posicao !== 'larga' ? ` style="width:${larg}%"` : ''
  const dados = larg && posicao !== 'larga' ? ` data-largura="${larg}"` : ''
  return `<figure data-tipo="imagem" data-posicao="${posicao}"${dados}${estilo}><img src="${escapar(src)}" alt="${escapar(legenda)}">${legenda ? `<figcaption>${escapar(legenda)}</figcaption>` : ''}</figure>`
}

export function galeriaHtml({ imagens = [], legenda = '' }) {
  const figuras = imagens.map((i) => `<figure><img src="${escapar(i.src)}" alt="${escapar(i.legenda || '')}">${i.legenda ? `<figcaption>${escapar(i.legenda)}</figcaption>` : ''}</figure>`).join('')
  return `<div data-tipo="galeria" data-colunas="${Math.min(3, Math.max(2, imagens.length))}" data-legenda="${escapar(legenda)}">${figuras}</div>`
}

export function videoHtml({ youtube = '', src = '', poster = '', legenda = '' }) {
  const meio = youtube
    ? `<iframe src="https://www.youtube-nocookie.com/embed/${escapar(youtube)}" title="${escapar(legenda || 'Vídeo')}" allowfullscreen="true" loading="lazy"></iframe>`
    : `<video src="${escapar(src)}"${poster ? ` poster="${escapar(poster)}"` : ''} controls="true" preload="metadata"></video>`
  return `<figure data-tipo="video" data-youtube="${escapar(youtube)}" data-src="${escapar(src)}" data-poster="${escapar(poster)}"><div class="video">${meio}</div>${legenda ? `<figcaption>${escapar(legenda)}</figcaption>` : ''}</figure>`
}

// HTML do antigo editor (Quill): alinhamentos em classes passam a estilos
const doQuill = (html = '') => html
  .replace(/class="ql-align-(center|right|justify)"/g, 'style="text-align: $1"')
  .replace(/&nbsp;/g, ' ')

function blocoHtml(b) {
  switch (b.tipo) {
    case 'texto': return doQuill(b.html)
    case 'paragrafo': return b.texto ? `<p>${escapar(b.texto)}</p>` : ''
    case 'subtitulo': return b.texto ? `<h2>${escapar(b.texto)}</h2>` : ''
    case 'imagem': return b.src ? figuraHtml(b) : ''
    case 'galeria': return (b.imagens || []).length ? galeriaHtml(b) : ''
    case 'video': return b.youtube || b.src ? videoHtml(b) : ''
    case 'citacao': return b.texto ? `<blockquote><p>${escapar(b.texto)}</p>${b.autor ? `<p>— ${escapar(b.autor)}</p>` : ''}</blockquote>` : ''
    case 'lista': {
      const tag = b.ordenada ? 'ol' : 'ul'
      return `<${tag}>${(b.itens || []).map((i) => `<li><p>${escapar(i)}</p></li>`).join('')}</${tag}>`
    }
    case 'destaque': return `<aside data-tipo="destaque">${b.titulo ? `<p><strong>${escapar(b.titulo)}</strong></p>` : ''}<p>${escapar(b.texto || '')}</p></aside>`
    case 'referencias': return (b.itens || []).filter(Boolean).length
      ? `<h3>Referências</h3><ol>${b.itens.filter(Boolean).map((i) => `<li><p>${escapar(i)}</p></li>`).join('')}</ol>`
      : ''
    default: return ''
  }
}

export const blocosParaHtml = (blocos = []) => blocos.map(blocoHtml).join('')

// texto vazio ("<p></p>")
export const htmlVazio = (html) => !String(html || '').replace(/<p>\s*<\/p>|<p><br><\/p>|\s/g, '')

// ao abrir: o corpo passa a um único bloco de texto
export function prepararCorpo(blocos = []) {
  return [{ tipo: 'texto', html: blocosParaHtml(blocos) }]
}

// ao guardar: sem corpo vazio
export function limparCorpo(blocos = []) {
  const html = blocosParaHtml(blocos)
  return htmlVazio(html) ? [] : [{ tipo: 'texto', html }]
}

// estatísticas do texto para a coluna lateral
export function medirCorpo(blocos = [], extra = '') {
  const html = blocosParaHtml(blocos)
  const texto = html.replace(/<(figure|div)[^>]*data-tipo="(imagem|galeria|video)"[\s\S]*?<\/\1>/g, ' ').replace(/<[^>]+>/g, ' ')
  const palavras = `${extra} ${texto}`.split(/\s+/).filter(Boolean).length
  return {
    palavras,
    minutos: Math.max(1, Math.round(palavras / 200)),
    imagens: (html.match(/<img /g) || []).length,
    videos: (html.match(/data-tipo="video"/g) || []).length,
  }
}
