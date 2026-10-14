import { ErroValidacao } from './erros.js'

/*
  Núcleo partilhado dos questionários de opinião (inquéritos das cadeiras e inquéritos institucionais):
  perguntas de escolha, de escala (1 a 5) e abertas; respostas validadas e resultados agregados.
*/

const erro = (campo, mensagem) => new ErroValidacao(mensagem, { campo })
export const TIPOS_PERGUNTA_OPINIAO = ['escala', 'escolha', 'aberta']

export const ESCALA = ['Discordo totalmente', 'Discordo', 'Nem concordo nem discordo', 'Concordo', 'Concordo totalmente']

/*
  Respostas de um estudante, conferidas com as perguntas:
  escolha -> índices das opções; escala -> 1 a 5 (obrigatória); aberta -> texto (opcional).
*/
export function limparRespostasInquerito(perguntas, respostas) {
  const r = respostas && typeof respostas === 'object' ? respostas : {}
  const limpas = {}
  perguntas.forEach((p, i) => {
    const v = r[i] ?? r[String(i)]
    if (p.tipo === 'escolha') {
      const lista = [...new Set((Array.isArray(v) ? v : v === undefined || v === null ? [] : [v]).map(Number))]
        .filter((x) => Number.isInteger(x) && x >= 0 && x < p.opcoes.length)
      if (lista.length === 0) throw erro('respostas', 'Escolha uma opção.')
      if (!p.multipla && lista.length > 1) throw erro('respostas', 'Escolha só uma opção.')
      limpas[i] = lista.sort((a, b) => a - b)
    } else if (p.tipo === 'escala') {
      const n = Number(v)
      if (!Number.isInteger(n) || n < 1 || n > 5) throw erro('respostas', `Responda a todas as afirmações (falta a ${i + 1}.ª).`)
      limpas[i] = n
    } else {
      const t = String(v ?? '').trim()
      if (t.length > 2000) throw erro('respostas', 'Cada comentário tem até 2000 caracteres.')
      if (t) limpas[i] = t
    }
  })
  return limpas
}

// resultados agregados (nunca dizem quem respondeu o quê)
export function resultadosInquerito(perguntas, respostas) {
  const total = respostas.length
  return {
    total,
    perguntas: perguntas.map((p, i) => {
      const valores = respostas.map((r) => r[i] ?? r[String(i)]).filter((v) => v !== undefined && v !== null)
      if (p.tipo === 'escolha') {
        const contagens = p.opcoes.map((_, j) => valores.filter((v) => v.includes(j)).length)
        return { ...p, contagens, percentagens: contagens.map((c) => (total ? Math.round((c / total) * 100) : 0)) }
      }
      if (p.tipo === 'escala') {
        const distribuicao = [1, 2, 3, 4, 5].map((n) => valores.filter((v) => v === n).length)
        const media = valores.length ? Math.round((valores.reduce((s, v) => s + v, 0) / valores.length) * 100) / 100 : null
        return { ...p, distribuicao, media }
      }
      // comentários por ordem alfabética, para não revelar a ordem de chegada
      return { ...p, comentarios: [...valores].sort((a, b) => a.localeCompare(b, 'pt')) }
    }),
  }
}

// média global das afirmações da escala (síntese da avaliação)
export function mediaGlobal(resultados) {
  const medias = resultados.perguntas.filter((p) => p.tipo === 'escala' && p.media !== null).map((p) => p.media)
  return medias.length ? Math.round((medias.reduce((s, v) => s + v, 0) / medias.length) * 100) / 100 : null
}

// perguntas de um inquérito: 1 a 30, cada uma escala, escolha (2 a 10 opções) ou aberta
export function validarPerguntasOpiniao(lista) {
  if (!Array.isArray(lista) || !lista.length || lista.length > 30) throw erro('perguntas', 'O inquérito tem de 1 a 30 perguntas.')
  return lista.map((p, i) => {
    const tipo = TIPOS_PERGUNTA_OPINIAO.includes(p?.tipo) ? p.tipo : null
    if (!tipo) throw erro('perguntas', `Pergunta ${i + 1}: tipo inválido.`)
    const texto = String(p.texto ?? '').trim()
    if (texto.length < 3 || texto.length > 500) throw erro('perguntas', `Pergunta ${i + 1}: escreva o texto (3 a 500 caracteres).`)
    if (tipo !== 'escolha') return { tipo, texto }
    const opcoes = (Array.isArray(p.opcoes) ? p.opcoes : []).map((o) => String(o ?? '').trim()).filter(Boolean)
    if (opcoes.length < 2 || opcoes.length > 10) throw erro('perguntas', `Pergunta ${i + 1}: de 2 a 10 opções.`)
    if (new Set(opcoes.map((o) => o.toLowerCase())).size !== opcoes.length) throw erro('perguntas', `Pergunta ${i + 1}: as opções têm de ser diferentes.`)
    return { tipo, texto, opcoes, multipla: Boolean(p.multipla) }
  })
}
