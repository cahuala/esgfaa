// "Gen. Carlos Vieira" -> "CV" (ignora a patente abreviada)
export function iniciais(nome) {
  const partes = nome.split(' ').filter((p) => !p.endsWith('.'))
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

// minutos de leitura a partir dos blocos de conteúdo (~200 palavras por minuto)
export function tempoLeitura(blocos = []) {
  const texto = blocos
    .map((b) => [b.texto, b.titulo, b.html && b.html.replace(/<[^>]+>/g, ' '), ...(b.itens || [])].filter(Boolean).join(' '))
    .join(' ')
  const palavras = texto.split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(palavras / 200))
}

// pesquisa sem distinguir maiúsculas nem acentos
export function normalizar(texto) {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

// "Um ano centrado na liderança" -> "um-ano-centrado-na-lideranca" (âncoras de subtítulos)
export function ancora(texto) {
  return normalizar(texto).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// subtítulos de um corpo (blocos "subtitulo" e títulos <h2> do texto formatado) para o índice "Nesta notícia"
export function subtitulosDe(blocos = []) {
  return blocos.flatMap((b) => {
    if (b.tipo === 'subtitulo' && b.texto) return [b.texto]
    if (b.tipo === 'texto' && b.html) {
      return [...b.html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)]
        .map((m) => m[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim())
        .filter(Boolean)
    }
    return []
  })
}
