// as mensagens dos comandantes (Páginas › Página inicial › Mensagem do Comandante): só as que têm texto;
// o actual primeiro (o marcado «actual», ou o primeiro da lista), depois os anteriores pela ordem do painel
export function mensagensDosComandantes(paginas) {
  const c = paginas?.home?.comandante ?? {}
  const lista = (c.mensagens ?? []).filter((m) => m && String(m.mensagem ?? '').trim())
  const i = Math.max(0, lista.findIndex((m) => m.actual))
  const actual = lista[i] ?? null
  return { etiqueta: c.etiqueta || 'Mensagem do Comandante', titulo: c.titulo || 'Mensagem do Comandante', actual, anteriores: lista.filter((_, k) => k !== i) }
}
export const nomeCompleto = (m) => [m.posto, m.nome].filter(Boolean).join(' ')
// a mensagem em parágrafos (linhas em branco no painel)
export const paragrafos = (t) => String(t ?? '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
