import { ErroValidacao } from '../comum/erros.js'
import { limparTexto } from '../comum/texto.js'
import { normalizarEmail } from '../identidade/email.js'

// Regras do portal académico (sem base de dados nem HTTP)

export const TIPOS_CONTA = ['estudante', 'docente']
export const ESTADOS_MATRICULA = ['ativa', 'suspensa', 'concluida', 'anulada']
export const ESTADOS_PRESENCA = ['presente', 'falta', 'justificada']
// período da cadeira e papel de cada docente alocado
export const PERIODOS = { 1: '1.º semestre', 2: '2.º semestre', anual: 'Anual' }
export const PAPEIS_DOCENCIA = ['regente', 'assistente']
export const TIPOS_MATERIAL = ['ficheiro', 'ligacao', 'video']
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

/*
  Avaliação no ensino superior angolano (modelo do regulamento do ISP Tundavala, art. 19.º a 26.º;
  cada instituição tem o seu regulamento, por isso os números ficam aqui juntos):
  - duas provas parcelares (1.ª e 2.ª prova) por semestre; a sua média é a MAC (média de avaliação contínua);
  - MAC ≥ 14 sem nenhuma prova negativa: aprovado com dispensa de exame, nota final = MAC;
  - os restantes fazem exame na época normal: nota final = 40 % MAC + 60 % exame;
  - quem reprova no exame vai à época de recurso, com a mesma fórmula (o recurso substitui o exame);
  - a nota final é arredondada às unidades; classificação: < 10 reprovado, 10–13 suficiente, 14–16 bom, 17–20 muito bom.
*/
export const AVALIACAO = { macDispensa: 14, pesoMac: 0.4, pesoExame: 0.6 }
export const COMPONENTES_NOTA = ['p1', 'p2', 'exame', 'recurso']
export const NOMES_COMPONENTES = { p1: '1.ª Prova', p2: '2.ª Prova', exame: 'Exame', recurso: 'Recurso' }

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

export function classificacao(nota) {
  if (nota === null || nota === undefined) return null
  if (nota < NOTA_MINIMA_APROVACAO) return 'Reprovado'
  if (nota < 14) return 'Suficiente'
  if (nota < 17) return 'Bom'
  return 'Muito bom'
}

const temNota = (v) => v !== null && v !== undefined && v !== ''

/*
  Resultado de um estudante numa cadeira a partir das notas lançadas (null = ainda sem nota).
  situacao: em_curso (faltam provas) | dispensado | exame (aguarda exame) | recurso (aguarda recurso)
            | aprovado | reprovado
*/
export function resultadoDisciplina({ p1 = null, p2 = null, exame = null, recurso = null } = {}) {
  const v = (x) => (temNota(x) ? Number(x) : null)
  const [n1, n2, ne, nr] = [v(p1), v(p2), v(exame), v(recurso)]
  const vazio = { mac: null, final: null, situacao: 'em_curso', classificacao: null }
  if (n1 === null || n2 === null) return vazio
  const mac = Math.round(((n1 + n2) / 2) * 10) / 10
  const comPeso = (prova) => Math.round(AVALIACAO.pesoMac * mac + AVALIACAO.pesoExame * prova)
  const fim = (final, situacao) => ({ mac, final, situacao, classificacao: final === null ? null : classificacao(final) })

  if (mac >= AVALIACAO.macDispensa && n1 >= NOTA_MINIMA_APROVACAO && n2 >= NOTA_MINIMA_APROVACAO) {
    return fim(Math.round(mac), 'dispensado')
  }
  if (ne === null) return fim(null, 'exame')
  const normal = comPeso(ne)
  if (normal >= NOTA_MINIMA_APROVACAO) return fim(normal, 'aprovado')
  if (nr === null) return { ...fim(normal, 'recurso'), classificacao: null }
  const final = comPeso(nr)
  return fim(final, final >= NOTA_MINIMA_APROVACAO ? 'aprovado' : 'reprovado')
}

/*
  Alocação de docentes a uma cadeira: no máximo um regente, sem docentes repetidos,
  horas inteiras de 0 a 1000. Devolve a lista limpa.
*/
export function validarAlocacao(lista) {
  if (!Array.isArray(lista) || lista.length > 20) throw erro('docentes', 'Lista de docentes inválida.')
  const vistos = new Set()
  const limpa = lista.map((d) => {
    const docenteId = Number(d.docenteId)
    if (!Number.isSafeInteger(docenteId) || docenteId < 1) throw erro('docentes', 'Escolha um docente.')
    if (vistos.has(docenteId)) throw erro('docentes', 'O mesmo docente está alocado duas vezes.')
    vistos.add(docenteId)
    const horas = Number(d.horas ?? 0)
    if (!Number.isInteger(horas) || horas < 0 || horas > 1000) throw erro('horas', 'Horas inválidas (0 a 1000).')
    return { docenteId, papel: escolha(d.papel || 'assistente', 'papel', 'Papel', PAPEIS_DOCENCIA), horas }
  })
  if (limpa.filter((d) => d.papel === 'regente').length > 1) throw erro('docentes', 'A cadeira só pode ter um regente.')
  return limpa
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

// ---------- calendário académico ----------

export const TIPOS_EVENTO = {
  p1: '1.ª Prova', p2: '2.ª Prova', exame: 'Exame', recurso: 'Recurso', geral: 'Evento', feriado: 'Feriado / sem aulas',
}
export const TIPOS_EVENTO_CADEIRA = ['p1', 'p2', 'exame', 'recurso', 'geral']

export function validarEvento(dados, tiposPermitidos = Object.keys(TIPOS_EVENTO)) {
  const tipo = escolha(dados.tipo, 'tipo', 'Tipo', tiposPermitidos)
  if (!dataValida(dados.data)) throw erro('data', 'Indique a data.')
  const inicio = dados.inicio || ''
  const fim = dados.fim || ''
  if ((inicio && !HORA.test(inicio)) || (fim && !HORA.test(fim))) throw erro('inicio', 'Horas no formato HH:MM.')
  if (inicio && fim && inicio >= fim) throw erro('fim', 'A hora de fim tem de ser depois da de início.')
  return {
    tipo, data: dados.data, inicio, fim,
    titulo: texto(dados.titulo || TIPOS_EVENTO[tipo], 'titulo', 'Título', { min: 2, max: 150 }),
    local: texto(dados.local, 'local', 'Local', { max: 120, obrigatorio: false }),
    descricao: texto(dados.descricao, 'descricao', 'Descrição', { max: 2000, obrigatorio: false }),
  }
}

// intervalo pedido ao calendário: no máximo ~6 semanas e datas válidas
export function intervaloCalendario(de, ate) {
  if (!dataValida(de) || !dataValida(ate) || de > ate) throw erro('de', 'Intervalo de datas inválido.')
  const dias = (Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000
  if (dias > 45) throw erro('ate', 'Peça no máximo 45 dias de cada vez.')
  return { de, ate }
}

/*
  Aulas do horário semanal entre duas datas (AAAA-MM-DD), saltando os dias de feriado.
  diaSemana: 1 = segunda … 6 = sábado.
*/
export function expandirAulas(horarios, de, ate, feriados = []) {
  const semAulas = new Set(feriados)
  const aulas = []
  for (let t = Date.parse(`${de}T00:00:00Z`); t <= Date.parse(`${ate}T00:00:00Z`); t += 86_400_000) {
    const d = new Date(t)
    const data = d.toISOString().slice(0, 10)
    const dia = d.getUTCDay() === 0 ? 7 : d.getUTCDay()
    if (semAulas.has(data)) continue
    for (const h of horarios) if (h.diaSemana === dia) aulas.push({ ...h, data })
  }
  return aulas
}
