import { ErroValidacao } from '../../comum/erros.js'

/*
  Anotações do docente nos PDF entregues (correção no navegador). Guardam-se para poder voltar
  a editá-las; o PDF anotado que o estudante recebe é gerado no navegador do docente.
  { ficheiroId: [ { pagina, tipo, cor, … } ] } — coordenadas em pontos do PDF (origem no canto superior esquerdo)
    caneta: pontos [[x, y], …] · realce: x, y, w, h · texto: x, y, texto · certo / errado: x, y
*/
export const TIPOS_ANOTACAO = ['caneta', 'realce', 'texto', 'certo', 'errado']
const CORES = /^#[0-9a-f]{6}$/i
const MAX_ANOTACOES = 3000
const coordenada = (v) => Number.isFinite(v) && v >= -50 && v <= 20000

export function validarAnotacoes(entrada, ficheiroIds) {
  let a = entrada
  if (typeof a === 'string') {
    if (a.length > 1_500_000) throw new ErroValidacao('As anotações são demasiado grandes.', { campo: 'anotacoes' })
    try { a = JSON.parse(a || '{}') } catch { throw new ErroValidacao('Anotações inválidas.', { campo: 'anotacoes' }) }
  }
  if (!a || typeof a !== 'object' || Array.isArray(a)) throw new ErroValidacao('Anotações inválidas.', { campo: 'anotacoes' })
  const r = {}
  let total = 0
  for (const [id, lista] of Object.entries(a)) {
    if (!ficheiroIds.includes(id)) throw new ErroValidacao('As anotações são de um ficheiro que não pertence a esta entrega.', { campo: 'anotacoes' })
    if (!Array.isArray(lista)) throw new ErroValidacao('Anotações inválidas.', { campo: 'anotacoes' })
    total += lista.length
    if (total > MAX_ANOTACOES) throw new ErroValidacao(`No máximo ${MAX_ANOTACOES} anotações por entrega.`, { campo: 'anotacoes' })
    r[id] = lista.map((x) => {
      const pagina = Number(x?.pagina)
      if (!Number.isInteger(pagina) || pagina < 1 || pagina > 2000 || !TIPOS_ANOTACAO.includes(x?.tipo)) throw new ErroValidacao('Anotação inválida.', { campo: 'anotacoes' })
      const cor = CORES.test(x.cor || '') ? x.cor : '#e53917'
      const base = { pagina, tipo: x.tipo, cor }
      if (x.tipo === 'caneta') {
        const pontos = (Array.isArray(x.pontos) ? x.pontos : []).slice(0, 2000).map((p) => [Number(p?.[0]), Number(p?.[1])])
        if (pontos.length < 2 || !pontos.every(([px, py]) => coordenada(px) && coordenada(py))) throw new ErroValidacao('Traço inválido.', { campo: 'anotacoes' })
        return { ...base, pontos: pontos.map(([px, py]) => [Math.round(px * 10) / 10, Math.round(py * 10) / 10]), espessura: Math.min(12, Math.max(0.5, Number(x.espessura) || 2)) }
      }
      const px = Number(x.x)
      const py = Number(x.y)
      if (!coordenada(px) || !coordenada(py)) throw new ErroValidacao('Posição inválida.', { campo: 'anotacoes' })
      if (x.tipo === 'realce') {
        const w = Number(x.w)
        const h = Number(x.h)
        if (!coordenada(w) || !coordenada(h) || w <= 0 || h <= 0) throw new ErroValidacao('Realce inválido.', { campo: 'anotacoes' })
        return { ...base, x: px, y: py, w, h }
      }
      if (x.tipo === 'texto') {
        const texto = String(x.texto ?? '').replaceAll(String.fromCharCode(0), '').trim().slice(0, 1000)
        if (!texto) throw new ErroValidacao('Comentário vazio.', { campo: 'anotacoes' })
        return { ...base, x: px, y: py, texto }
      }
      return { ...base, x: px, y: py }
    })
  }
  return r
}
