// Texto justificado com partes a negrito para os PDF (jsPDF, Times): documentos do pessoal, diplomas e certificados.
/*
  Parágrafo justificado com partes a negrito: partes = ['texto normal ', { b: 'TEXTO A NEGRITO' }, …].
  Devolve o y depois do parágrafo.
*/
export function paragrafo(doc, partes, y, { x, w, recuo = 12, entre = 6.6, justificar = true, tam = 14, estilo = 'normal', antesDaLinha = (yy) => yy, centrar = false } = {}) {
  const fonte = (b) => (b ? (estilo === 'italic' ? 'bolditalic' : 'bold') : estilo)
  doc.setFontSize(tam)
  const palavras = []
  for (const p of partes) {
    const b = typeof p === 'object'
    const t = b ? p.b : p
    const bocados = String(t).split(/(\s+)/)
    for (const s of bocados) {
      if (!s) continue
      if (/^\s+$/.test(s)) palavras.push({ espaco: true })
      else {
        // juntar a pontuação colada à palavra anterior de outro estilo («NOME,»)
        palavras.push({ t: s, b })
      }
    }
  }
  // agrupar em «tokens» separados por espaço (um token pode ter partes de estilos diferentes)
  const tokens = []
  let atual = []
  for (const p of palavras) {
    if (p.espaco) { if (atual.length) tokens.push(atual); atual = [] } else atual.push(p)
  }
  if (atual.length) tokens.push(atual)
  const largura = (tok) => tok.reduce((s, p) => { doc.setFont('times', fonte(p.b)); return s + doc.getTextWidth(p.t) }, 0)
  doc.setFont('times', estilo)
  const espaco = doc.getTextWidth(' ')
  const linhas = []
  let linha = []
  let lw = 0
  let primeira = true
  for (const tok of tokens) {
    const tw = largura(tok)
    const disponivel = w - (primeira ? recuo : 0)
    if (linha.length && lw + espaco + tw > disponivel) { linhas.push({ linha, lw, primeira }); linha = []; lw = 0; primeira = false }
    lw += (linha.length ? espaco : 0) + tw
    linha.push({ tok, tw })
  }
  if (linha.length) linhas.push({ linha, lw, primeira, ultima: true })
  for (const l of linhas) {
    y = antesDaLinha(y)
    const x0 = centrar ? x + (w - l.lw) / 2 : x + (l.primeira ? recuo : 0)
    const disponivel = w - (l.primeira ? recuo : 0)
    const extra = justificar && !centrar && !l.ultima && l.linha.length > 1 ? (disponivel - l.lw) / (l.linha.length - 1) : 0
    let xx = x0
    for (const { tok, tw } of l.linha) {
      let px = xx
      for (const p of tok) { doc.setFont('times', fonte(p.b)); doc.text(p.t, px, y); px += doc.getTextWidth(p.t) }
      xx += tw + espaco + extra
    }
    y += entre
  }
  doc.setFont('times', 'normal')
  return y
}

