/*
  As sessões do programa de uma cadeira (o «Plano das sessões» que a carga dos planos de curso põe no programa: uma
  tabela Sessão | Tema / OE | Objectivo de aprendizagem | TE | Método) e os capítulos que se fazem com elas, como os
  tópicos do Moodle: quando o plano agrupa as aulas por tema (o CEAO), um capítulo por tema com as aulas no resumo;
  senão, um capítulo por sessão («CEO 01 — Compreender …»).
*/
const ENTIDADES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' }
const limpar = (t) => String(t ?? '').replace(/<[^>]+>/g, ' ').replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m) => ENTIDADES[m]).replace(/\s+/g, ' ').trim()

export function sessoesDoPrograma(html) {
  const tabela = /<h4>\s*Plano das sessões\s*<\/h4>\s*<table[\s\S]*?<\/table>/i.exec(String(html ?? ''))
  if (!tabela) return []
  const corpo = /<tbody>([\s\S]*?)<\/tbody>/i.exec(tabela[0])?.[1] ?? ''
  return [...corpo.matchAll(/<tr>([\s\S]*?)<\/tr>/gi)].map((m) => {
    const c = [...m[1].matchAll(/<td>([\s\S]*?)<\/td>/gi)].map((x) => limpar(x[1]))
    return { sessao: c[0] ?? '', tema: c[1] ?? '', objectivo: c[2] ?? '', tempos: c[3] ?? '', metodo: c[4] ?? '' }
  }).filter((s) => s.objectivo)
}

const corta = (t, n) => (t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t)

export function capitulosDoPrograma(html) {
  const sessoes = sessoesDoPrograma(html)
  if (!sessoes.length) return []
  // o tema só agrupa quando se repete (no CSCD a coluna leva o objectivo específico «1.1», que também se repete,
  // mas cada sessão tem o seu código «CEO 01»: aí fica uma sessão por capítulo)
  const temCodigo = sessoes.every((s) => /^[A-Z]{2,8}\s*\d/.test(s.sessao))
  const temas = new Set(sessoes.map((s) => s.tema).filter(Boolean))
  if (!temCodigo && temas.size && temas.size < sessoes.length) {
    const grupos = []
    for (const s of sessoes) {
      const g = grupos.at(-1)
      if (g && g.tema === (s.tema || g.tema)) g.sessoes.push(s)
      else grupos.push({ tema: s.tema || `Sessões ${s.sessao}`, sessoes: [s] })
    }
    return grupos.map((g) => ({
      titulo: corta(g.tema, 150),
      resumo: corta(g.sessoes.map((s) => `• ${s.objectivo}${s.tempos ? ` (${s.tempos}${s.metodo ? `, ${s.metodo}` : ''})` : ''}`).join('\n'), 3000),
    }))
  }
  return sessoes.map((s) => ({
    titulo: corta(`${s.sessao}${/^\d+$/.test(s.sessao) ? '.' : ' —'} ${s.objectivo}`, 150),
    resumo: corta([s.tema && `Objectivo específico: ${s.tema}`, s.tempos && `Tempos escolares: ${s.tempos}`, s.metodo && `Método: ${s.metodo}`].filter(Boolean).join(' · '), 3000),
  }))
}
