import sanitizeHtml from 'sanitize-html'

const COR = [/^#[0-9a-f]{3,8}$/i, /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+))?\s*\)$/i, /^(inherit|transparent)$/]
const ESTILOS_TEXTO = {
  'text-align': [/^(left|right|center|justify)$/],
  color: COR,
  'background-color': COR,
  'font-size': [/^\d{1,3}(\.\d+)?(px|pt|em|rem|%)$/],
}
const LARGURA = [/^\d{1,3}(\.\d+)?%$/, /^\d{1,4}px$/]

/*
  Lista do que o editor do painel (TipTap) produz. Tudo o resto é retirado:
  scripts, eventos (onclick…), javascript:, iframes que não sejam do YouTube, estilos arbitrários.
  O site volta a filtrar ao mostrar (DOMPurify) — duas barreiras.
*/
const OPCOES = {
  allowedTags: [
    'p', 'br', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup', 'a', 'ul', 'ol', 'li', 'blockquote', 'hr',
    'figure', 'figcaption', 'img', 'div', 'iframe', 'video', 'aside', 'mark', 'span',
    'table', 'thead', 'tbody', 'tr', 'th', 'td', 'colgroup', 'col',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel', 'title'],
    img: ['src', 'alt', 'width', 'height', 'loading'],
    figure: ['data-tipo', 'data-posicao', 'data-largura', 'data-youtube', 'data-src', 'data-poster', 'style'],
    div: ['class', 'data-tipo', 'data-colunas', 'data-legenda'],
    aside: ['data-tipo'],
    iframe: ['src', 'title', 'allowfullscreen', 'loading', 'width', 'height'],
    video: ['src', 'poster', 'controls', 'preload'],
    ol: ['start', 'type'],
    mark: ['data-color', 'style'],
    span: ['style'],
    p: ['style'], h2: ['style'], h3: ['style'], h4: ['style'],
    table: ['style'], col: ['style'],
    th: ['colspan', 'rowspan', 'colwidth', 'style'],
    td: ['colspan', 'rowspan', 'colwidth', 'style'],
  },
  allowedClasses: { div: ['video'] },
  allowedStyles: {
    '*': ESTILOS_TEXTO,
    figure: { width: LARGURA },
    table: { 'min-width': LARGURA, width: LARGURA },
    col: { 'min-width': LARGURA, width: LARGURA },
    th: { ...ESTILOS_TEXTO, width: LARGURA },
    td: { ...ESTILOS_TEXTO, width: LARGURA },
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: { img: ['http', 'https'], video: ['http', 'https'], iframe: ['https'] },
  allowProtocolRelative: false,
  allowedIframeHostnames: ['www.youtube-nocookie.com', 'www.youtube.com', 'youtube.com', 'youtube-nocookie.com'],
  transformTags: {
    // ligações que abrem noutra janela não dão acesso à página de origem
    a: (tag, attribs) => {
      const a = { ...attribs }
      if (a.target && a.target !== '_blank') delete a.target
      if (a.target === '_blank') a.rel = 'noopener noreferrer nofollow'
      return { tagName: 'a', attribs: a }
    },
  },
}

export function filtrarHtml(html) {
  return sanitizeHtml(String(html ?? ''), OPCOES)
}

// filtra todos os campos "html" (corpo das notícias, artigos, eventos…) em qualquer profundidade
export function filtrarCamposHtml(valor) {
  if (Array.isArray(valor)) return valor.map(filtrarCamposHtml)
  if (valor && typeof valor === 'object') {
    return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, k === 'html' && typeof v === 'string' ? filtrarHtml(v) : filtrarCamposHtml(v)]))
  }
  return valor
}
