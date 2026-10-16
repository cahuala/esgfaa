import { LINGUAS } from '../../dominio/traducoes/textos.js'

const LOTE = 12_000 // caracteres por pedido

const sistema = (lingua) => `És o tradutor oficial do site da Escola Superior de Guerra das Forças Armadas Angolanas (ESG/FAA).
Traduz do português europeu para ${LINGUAS[lingua]} textos institucionais (notícias, artigos, cursos, eventos e páginas).
Regras:
- registo formal, claro e natural, com a terminologia militar e académica habitual na língua de destino;
- mantém nomes de pessoas, lugares e instituições; mantém siglas (ESG, FAA, CEM, SADC, …) e traduz os postos militares para o equivalente usual;
- mantém etiquetas HTML, marcas de formatação, números, datas e quebras de linha exatamente como estão;
- não acrescentes nem omitas informação.
Recebes um objeto JSON "caminho -> texto". Responde APENAS com um objeto JSON com exatamente as mesmas chaves e os textos traduzidos.`

// traduz um mapa de textos, em lotes, e devolve o mapa traduzido (só as chaves pedidas)
export async function traduzirComClaude(cliente, textos, lingua) {
  const entradas = Object.entries(textos)
  const lotes = []
  let atual = []
  let tamanho = 0
  for (const e of entradas) {
    if (tamanho + e[1].length > LOTE && atual.length) { lotes.push(atual); atual = []; tamanho = 0 }
    atual.push(e)
    tamanho += e[1].length
  }
  if (atual.length) lotes.push(atual)
  const r = {}
  for (const lote of lotes) {
    const pedido = Object.fromEntries(lote)
    const resposta = await cliente.json({ sistema: sistema(lingua), conteudo: JSON.stringify(pedido, null, 1), maxTokens: 8000 })
    for (const k of Object.keys(pedido)) if (typeof resposta[k] === 'string') r[k] = resposta[k]
  }
  return r
}
