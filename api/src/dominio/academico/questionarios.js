import { ErroValidacao } from '../comum/erros.js'
import { limparTexto } from '../comum/texto.js'

// Questionários online (como os do Moodle): perguntas de escolha e correção automática

export const TIPOS_PERGUNTA = { unica: 'Escolha única', multipla: 'Escolha múltipla', vf: 'Verdadeiro ou falso' }
export const MARGEM_ENTREGA_MS = 30_000 // tolerância de rede para a entrega no fim do tempo

const erro = (campo, mensagem) => new ErroValidacao(mensagem, { campo })

/*
  Valida uma pergunta vinda do docente. Opções: 2 a 8, pelo menos uma correta;
  escolha única e V/F têm exatamente uma correta; V/F tem as opções fixas.
*/
export function validarPergunta(p = {}) {
  const tipo = String(p.tipo || '')
  if (!TIPOS_PERGUNTA[tipo]) throw erro('tipo', 'Tipo de pergunta inválido.')
  const enunciado = limparTexto(p.enunciado)
  if (enunciado.length < 3 || enunciado.length > 2000) throw erro('enunciado', 'O enunciado tem entre 3 e 2000 caracteres.')
  const pontos = Number(String(p.pontos ?? 1).replace(',', '.'))
  if (!Number.isFinite(pontos) || pontos <= 0 || pontos > 100) throw erro('pontos', 'Os pontos vão de 0,25 a 100.')
  let opcoes
  if (tipo === 'vf') {
    const verdadeira = p.opcoes?.[0]?.correta === true || p.correta === true || p.correta === 'verdadeiro'
    opcoes = [{ texto: 'Verdadeiro', correta: verdadeira }, { texto: 'Falso', correta: !verdadeira }]
  } else {
    if (!Array.isArray(p.opcoes) || p.opcoes.length < 2 || p.opcoes.length > 8) throw erro('opcoes', 'Indique de 2 a 8 opções.')
    opcoes = p.opcoes.map((o) => {
      const texto = limparTexto(o?.texto)
      if (!texto || texto.length > 500) throw erro('opcoes', 'Cada opção tem de 1 a 500 caracteres.')
      return { texto, correta: o?.correta === true }
    })
    const corretas = opcoes.filter((o) => o.correta).length
    if (corretas === 0) throw erro('opcoes', 'Marque pelo menos uma opção correta.')
    if (tipo === 'unica' && corretas !== 1) throw erro('opcoes', 'Na escolha única só uma opção é correta.')
  }
  return { tipo, enunciado, pontos: Math.round(pontos * 100) / 100, opcoes }
}

// respostas do estudante: { perguntaId: [índices] }, só índices válidos e sem repetidos
export function limparRespostas(respostas, perguntas) {
  const r = respostas && typeof respostas === 'object' && !Array.isArray(respostas) ? respostas : {}
  const limpas = {}
  for (const p of perguntas) {
    const escolhidos = Array.isArray(r[p.id]) ? r[p.id] : r[p.id] === undefined ? [] : [r[p.id]]
    const validos = [...new Set(escolhidos.map(Number))].filter((i) => Number.isInteger(i) && i >= 0 && i < p.opcoes.length).sort((a, b) => a - b)
    if (p.tipo !== 'multipla' && validos.length > 1) validos.splice(1)
    if (validos.length) limpas[p.id] = validos
  }
  return limpas
}

/*
  Correção: cada pergunta vale os seus pontos se a escolha for exatamente a das opções corretas
  (na escolha múltipla, todas as corretas e nenhuma errada). Nota de 0 a 20, às centésimas.
*/
export function corrigir(perguntas, respostas) {
  const limpas = limparRespostas(respostas, perguntas)
  let total = 0
  let obtidos = 0
  const detalhe = perguntas.map((p) => {
    const certas = p.opcoes.map((o, i) => (o.correta ? i : -1)).filter((i) => i >= 0)
    const dadas = limpas[p.id] || []
    const certa = dadas.length === certas.length && dadas.every((i, k) => i === certas[k])
    total += Number(p.pontos)
    if (certa) obtidos += Number(p.pontos)
    return { perguntaId: p.id, certa, escolhidas: dadas, corretas: certas }
  })
  const nota = total ? Math.round((obtidos / total) * 20 * 100) / 100 : 0
  return { nota, obtidos: Math.round(obtidos * 100) / 100, total: Math.round(total * 100) / 100, detalhe }
}

/*
  Estado do questionário para o estudante num momento:
  em_breve (ainda não abriu) | aberto | fechado.
*/
export function estadoQuestionario(q, agora) {
  if (q.abre && agora < new Date(q.abre)) return 'em_breve'
  if (q.fecha && agora > new Date(q.fecha)) return 'fechado'
  return 'aberto'
}

// fim da tentativa: o que acontecer primeiro entre a duração e o fecho do questionário
export function limiteTentativa(q, inicio) {
  const fins = []
  if (q.duracao > 0) fins.push(new Date(inicio.getTime() + q.duracao * 60_000))
  if (q.fecha) fins.push(new Date(q.fecha))
  return fins.length ? new Date(Math.min(...fins.map((d) => d.getTime()))) : null
}

export const dentroDoTempo = (tentativa, agora) => !tentativa.limite || agora.getTime() <= new Date(tentativa.limite).getTime() + MARGEM_ENTREGA_MS
