// "Gen. Carlos Vieira" -> "CV" (ignora a patente abreviada)
export function iniciais(nome) {
  const partes = nome.split(' ').filter((p) => !p.endsWith('.'))
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

// minutos de leitura a partir dos blocos de conteúdo (~200 palavras por minuto)
export function tempoLeitura(blocos = []) {
  const texto = blocos
    .map((b) => [b.texto, b.titulo, ...(b.itens || [])].filter(Boolean).join(' '))
    .join(' ')
  const palavras = texto.split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(palavras / 200))
}

// pesquisa sem distinguir maiúsculas nem acentos
export function normalizar(texto) {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}
