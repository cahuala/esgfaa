import { ErroValidacao } from '../comum/erros.js'
import { limparTexto } from '../comum/texto.js'
import { normalizarEmail } from '../identidade/email.js'

// Regras do portal académico (sem base de dados nem HTTP)

export const TIPOS_CONTA = ['estudante', 'docente']
export const ESTADOS_MATRICULA = ['ativa', 'suspensa', 'concluida', 'anulada']
export const ESTADOS_PRESENCA = ['presente', 'falta', 'justificada']
export const TIPOS_MATERIAL = ['ficheiro', 'ligacao', 'video']
export const TIPOS_AVALIACAO = ['teste', 'trabalho', 'exame', 'participacao', 'outro']
export const TIPOS_PEDIDO = [
  'Declaração de matrícula',
  'Declaração de frequência',
  'Certificado de notas',
  'Certificado de conclusão',
  'Segunda via do cartão de estudante',
  'Outro',
]
export const ESTADOS_PEDIDO = ['pendente', 'em_tratamento', 'pronto', 'recusado']
export const NOTA_MINIMA_APROVACAO = 10

const erro = (campo, mensagem) => new ErroValidacao(mensagem, { campo })

export function texto(valor, campo, rotulo, { min = 1, max = 200, obrigatorio = true } = {}) {
  const t = limparTexto(valor)
  if (!t && !obrigatorio) return ''
  if (t.length < min || t.length > max) throw erro(campo, `${rotulo}: entre ${min} e ${max} caracteres.`)
  return t
}

export function escolha(valor, campo, rotulo, opcoes) {
  if (!opcoes.includes(valor)) throw erro(campo, `${rotulo}: escolha uma das opções.`)
  return valor
}

// ---------- contas ----------

/*
  O e-mail de entrada é o da Escola (ex.: nome@esgfaa.gov.ao).
  dominio vazio = aceita qualquer domínio (útil em testes ou instalações sem domínio próprio).
*/
export function emailDaEscola(email, dominio) {
  const e = normalizarEmail(email)
  if (dominio && !e.endsWith(`@${dominio}`)) throw erro('email', `Use o e-mail da Escola (…@${dominio}).`)
  return e
}

// "E2026-0007" / "D2026-0003"
export function numeroConta(tipo, ano, sequencia) {
  return `${tipo === 'docente' ? 'D' : 'E'}${ano}-${String(sequencia).padStart(4, '0')}`
}

// ---------- notas ----------

export function validarNota(valor) {
  if (valor === '' || valor === null || valor === undefined) return null // sem nota (apaga)
  const n = Number(String(valor).replace(',', '.'))
  if (!Number.isFinite(n) || n < 0 || n > 20) throw erro('nota', 'A nota deve estar entre 0 e 20.')
  return Math.round(n * 100) / 100
}

// a soma dos pesos das avaliações de uma cadeira não pode passar de 100 %
export function validarPeso(peso, outrosPesos) {
  const p = Number(peso)
  if (!Number.isInteger(p) || p < 1 || p > 100) throw erro('peso', 'O peso é uma percentagem inteira entre 1 e 100.')
  const soma = outrosPesos.reduce((s, x) => s + x, 0) + p
  if (soma > 100) throw erro('peso', `A soma dos pesos ficaria em ${soma} %: o máximo é 100 %.`)
  return p
}

/*
  Média ponderada das avaliações com nota (0 a 20, arredondada às décimas).
  completa: todas as avaliações (soma de pesos 100) têm nota.
*/
export function mediaPonderada(itens) {
  const comNota = itens.filter((i) => i.nota !== null && i.nota !== undefined)
  const pesoComNota = comNota.reduce((s, i) => s + i.peso, 0)
  const pesoTotal = itens.reduce((s, i) => s + i.peso, 0)
  if (!pesoComNota) return { media: null, completa: false, aprovado: null }
  const media = Math.round((comNota.reduce((s, i) => s + Number(i.nota) * i.peso, 0) / pesoComNota) * 10) / 10
  const completa = pesoTotal === 100 && pesoComNota === 100
  return { media, completa, aprovado: completa ? media >= NOTA_MINIMA_APROVACAO : null }
}

// ---------- trabalhos ----------

/*
  Estado de um trabalho para um estudante:
  aberto (pode entregar), atrasado (fora de prazo mas aceita atrasos), fechado.
*/
export function estadoPrazo(prazo, agora, aceitaAtraso) {
  if (agora <= new Date(prazo)) return 'aberto'
  return aceitaAtraso ? 'atrasado' : 'fechado'
}

export const entregaAtrasada = (entregueEm, prazo) => new Date(entregueEm) > new Date(prazo)

// ---------- horário e presenças ----------

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/

export function validarHorario({ diaSemana, inicio, fim, sala }) {
  const dia = Number(diaSemana)
  if (!Number.isInteger(dia) || dia < 1 || dia > 6) throw erro('diaSemana', 'Dia da semana inválido (segunda a sábado).')
  if (!HORA.test(inicio) || !HORA.test(fim)) throw erro('inicio', 'Horas no formato HH:MM.')
  if (inicio >= fim) throw erro('fim', 'A hora de fim tem de ser depois da de início.')
  return { diaSemana: dia, inicio, fim, sala: texto(sala, 'sala', 'Sala', { max: 60, obrigatorio: false }) }
}

// percentagem de presença (justificadas não contam como falta)
export function assiduidade(presencas) {
  if (!presencas.length) return null
  const contam = presencas.filter((p) => p.estado !== 'justificada')
  if (!contam.length) return 100
  return Math.round((contam.filter((p) => p.estado === 'presente').length / contam.length) * 100)
}

export const dataValida = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '') && !Number.isNaN(Date.parse(d))
