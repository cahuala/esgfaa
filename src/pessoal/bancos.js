// bancos angolanos: nome completo, sigla e as cores do cartão Multicaixa (ficha e formulário)
export const BANCOS = {
  BAI: { nome: 'Banco Angolano de Investimentos', cor: ['#00305f', '#0b5aa6'] },
  BPC: { nome: 'Banco de Poupança e Crédito', cor: ['#063b8a', '#1f74c9'] },
  BFA: { nome: 'Banco de Fomento Angola', cor: ['#d9530b', '#f5a03a'] },
  BIC: { nome: 'Banco BIC', cor: ['#b3001b', '#e5323c'] },
  BNI: { nome: 'Banco de Negócios Internacional', cor: ['#1b2a4a', '#3d5a8c'] },
  ATL: { nome: 'Banco Millennium Atlântico', cor: ['#0b2545', '#13a3a0'], sigla: 'Atlântico' },
  BCI: { nome: 'Banco de Comércio e Indústria', cor: ['#0d5c2f', '#2e9a55'] },
  BSOL: { nome: 'Banco Sol', cor: ['#e08a00', '#ffc72c'], sigla: 'Banco Sol' },
  KEVE: { nome: 'Banco Keve', cor: ['#4a1d6b', '#8a4fbf'], sigla: 'Keve' },
  SBA: { nome: 'Standard Bank Angola', cor: ['#002b80', '#0a62d9'], sigla: 'Standard Bank' },
  BCGA: { nome: 'Banco Caixa Geral Angola', cor: ['#00346e', '#2a6db5'], sigla: 'Caixa Angola' },
  BE: { nome: 'Banco Económico', cor: ['#00594f', '#1e9e8a'], sigla: 'Económico' },
  BYETU: { nome: 'Banco Yetu', cor: ['#5b1235', '#b23a6b'], sigla: 'Yetu' },
}
// o banco escrito na ficha («BPC», «Banco de Poupança e Crédito», «Atlântico»…) -> a entrada da lista
export function bancoDe(texto) {
  const t = String(texto ?? '').trim().toLowerCase()
  if (!t) return null
  return Object.entries(BANCOS).find(([k, b]) => t === k.toLowerCase() || t === b.nome.toLowerCase() || (b.sigla && t.includes(b.sigla.toLowerCase())) || t.includes(b.nome.toLowerCase()))?.[0] ?? null
}
