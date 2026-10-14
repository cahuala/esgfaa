import { ErroValidacao } from '../../comum/erros.js'

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

