// cor pastel da etiqueta de cada secção/categoria (como no modelo Corporate)
const CORES = {
  institucional: 'vermelho',
  cerimonia: 'dourado', cerimonias: 'dourado',
  cooperacao: 'azul',
  formacao: 'verde',
  investigacao: 'roxo',
  conferencia: 'azul', conferencias: 'azul',
  seminario: 'roxo',
  palestra: 'verde',
  'visita-oficial': 'cinzento',
  artigo: 'roxo', ensaio: 'verde', 'nota-de-investigacao': 'dourado',
}
const ROTACAO = ['azul', 'verde', 'roxo', 'dourado', 'vermelho', 'cinzento']

const chave = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, '-')

export function corEtiqueta(texto) {
  const k = chave(texto)
  if (CORES[k]) return CORES[k]
  let h = 0
  for (const c of k) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return ROTACAO[h % ROTACAO.length]
}
