import { ErroValidacao } from '../comum/erros.js'

/*
  Inquéritos de uma cadeira:
  - sondagem: uma pergunta de escolha (como o "Choice" do Moodle), feita pelo docente;
  - avaliacao: inquérito pedagógico de avaliação do docente, lançado pela Administração Escolar,
    sempre anónimo, com um modelo fixo (escala de 1 a 5 e duas perguntas abertas).
*/

export const TIPOS_INQUERITO = ['sondagem', 'avaliacao']
// quando o estudante vê os resultados de uma sondagem
export const RESULTADOS = ['apos_responder', 'apos_fecho', 'nunca']
// o docente só vê a sua avaliação depois do fecho e com pelo menos este número de respostas (anonimato)
export const MINIMO_RESPOSTAS_AVALIACAO = 3

export const ESCALA = ['Discordo totalmente', 'Discordo', 'Nem concordo nem discordo', 'Concordo', 'Concordo totalmente']

export const PERGUNTAS_AVALIACAO = [
  { tipo: 'escala', texto: 'O docente apresentou os objetivos, o programa e as regras de avaliação da cadeira.' },
  { tipo: 'escala', texto: 'As aulas foram bem preparadas e organizadas.' },
  { tipo: 'escala', texto: 'O docente explicou a matéria com clareza.' },
  { tipo: 'escala', texto: 'O docente foi pontual e assíduo.' },
  { tipo: 'escala', texto: 'O docente mostrou disponibilidade para esclarecer dúvidas.' },
  { tipo: 'escala', texto: 'Os materiais de apoio foram úteis.' },
  { tipo: 'escala', texto: 'A avaliação foi coerente com a matéria lecionada.' },
  { tipo: 'escala', texto: 'Apreciação global do desempenho do docente.' },
  { tipo: 'aberta', texto: 'O que correu bem nesta cadeira?' },
  { tipo: 'aberta', texto: 'O que pode melhorar?' },
]

const erro = (campo, mensagem) => new ErroValidacao(mensagem, { campo })

// pergunta e opções de uma sondagem
export function validarSondagem(d) {
  const pergunta = String(d.pergunta ?? '').trim()
  if (pergunta.length < 3 || pergunta.length > 500) throw erro('pergunta', 'Escreva a pergunta (3 a 500 caracteres).')
  const opcoes = (Array.isArray(d.opcoes) ? d.opcoes : []).map((o) => String(o ?? '').trim()).filter(Boolean)
  if (opcoes.length < 2 || opcoes.length > 10) throw erro('opcoes', 'A sondagem tem de 2 a 10 opções.')
  if (opcoes.some((o) => o.length > 200)) throw erro('opcoes', 'Cada opção tem até 200 caracteres.')
  if (new Set(opcoes.map((o) => o.toLowerCase())).size !== opcoes.length) throw erro('opcoes', 'As opções têm de ser diferentes.')
  return [{ tipo: 'escolha', texto: pergunta, opcoes, multipla: Boolean(d.multipla) }]
}

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
