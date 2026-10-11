import { ErroValidacao } from '../comum/erros.js'
import { limparTexto } from '../comum/texto.js'
import { normalizarEmail } from '../identidade/email.js'

// Candidatura de um oficial a um curso da Escola (formulário público por passos)

export const ESTADOS_CANDIDATURA = ['recebida', 'em_analise', 'admitida', 'nao_admitida']
export const ESTADOS_FINAIS = ['admitida', 'nao_admitida']
export const RAMOS = ['Exército', 'Força Aérea Nacional', 'Marinha de Guerra Angolana']
export const POSTOS = [
  'Tenente', 'Capitão', 'Major', 'Tenente-Coronel', 'Coronel',
  'Primeiro-Tenente', 'Capitão-Tenente', 'Capitão-de-Fragata', 'Capitão-de-Mar-e-Guerra', 'Outro',
]
export const HABILITACOES = ['Licenciatura', 'Mestrado', 'Doutoramento', 'Formação militar superior', 'Outra']

// erro associado a um campo do formulário (o site mostra-o junto do campo certo)
const erro = (campo, mensagem) => new ErroValidacao(mensagem, { campo })

function texto(valor, campo, rotulo, { min = 1, max = 200, obrigatorio = true } = {}) {
  const t = limparTexto(valor).replace(/\s+/g, ' ')
  if (!t && !obrigatorio) return ''
  if (t.length < min || t.length > max) throw erro(campo, `${rotulo}: entre ${min} e ${max} caracteres.`)
  return t
}

function escolha(valor, campo, rotulo, opcoes) {
  if (!opcoes.includes(valor)) throw erro(campo, `${rotulo}: escolha uma das opções.`)
  return valor
}

// idade completa numa data (AAAA-MM-DD)
export function idade(dataNascimento, hoje) {
  const [a, m, d] = dataNascimento.split('-').map(Number)
  let anos = hoje.getUTCFullYear() - a
  if (hoje.getUTCMonth() + 1 < m || (hoje.getUTCMonth() + 1 === m && hoje.getUTCDate() < d)) anos -= 1
  return anos
}

/*
  Valida e normaliza os dados enviados pelo formulário.
  cursos: identificadores dos cursos publicados; hoje: data de referência (idade).
*/
export function validarCandidatura(entrada, { cursos, hoje }) {
  if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) throw new ErroValidacao('Dados inválidos.')
  const e = entrada

  // 1. curso
  const curso = String(e.curso || '')
  if (!cursos.includes(curso)) throw erro('curso', 'Escolha um dos cursos disponíveis.')

  // 2. dados pessoais
  const nome = texto(e.nome, 'nome', 'Nome completo', { min: 5, max: 150 })
  if (nome.split(' ').length < 2) throw erro('nome', 'Indique o nome completo (nome e apelido).')
  const dataNascimento = String(e.dataNascimento || '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataNascimento) || Number.isNaN(Date.parse(dataNascimento))) {
    throw erro('dataNascimento', 'Data de nascimento inválida.')
  }
  const anos = idade(dataNascimento, hoje)
  if (anos < 21 || anos > 70) throw erro('dataNascimento', 'A idade deve estar entre 21 e 70 anos.')
  const bi = String(e.bi || '').trim().toUpperCase()
  if (!/^[0-9A-Z]{6,20}$/.test(bi)) throw erro('bi', 'Número do bilhete de identidade inválido.')
  let email
  try {
    email = normalizarEmail(e.email)
  } catch {
    throw erro('email', 'E-mail inválido.')
  }
  const telefone = String(e.telefone || '').trim()
  if (!/^\+?[\d][\d\s-]{7,19}$/.test(telefone)) throw erro('telefone', 'Número de telefone inválido.')
  const provincia = texto(e.provincia, 'provincia', 'Província', { min: 2, max: 60 })
  const morada = texto(e.morada, 'morada', 'Morada', { max: 200, obrigatorio: false })

  // 3. situação militar e formação
  const ramo = escolha(e.ramo, 'ramo', 'Ramo', RAMOS)
  const posto = escolha(e.posto, 'posto', 'Posto', POSTOS)
  const nip = String(e.nip || '').trim().toUpperCase()
  if (!/^[0-9A-Z-]{4,20}$/.test(nip)) throw erro('nip', 'Número de identificação militar (NIP) inválido.')
  const unidade = texto(e.unidade, 'unidade', 'Unidade / órgão', { min: 2, max: 150 })
  const anosServico = Number(e.anosServico)
  if (!Number.isInteger(anosServico) || anosServico < 0 || anosServico > 45) throw erro('anosServico', 'Anos de serviço: número entre 0 e 45.')
  if (anosServico > anos - 16) throw erro('anosServico', 'Os anos de serviço não são compatíveis com a idade.')
  const habilitacoes = escolha(e.habilitacoes, 'habilitacoes', 'Habilitações', HABILITACOES)
  const areaFormacao = texto(e.areaFormacao, 'areaFormacao', 'Área de formação', { max: 120, obrigatorio: false })
  const motivacao = texto(e.motivacao, 'motivacao', 'Motivação', { min: 30, max: 2000 })

  // 4. confirmação
  if (e.declaracao !== true) throw erro('declaracao', 'Confirme que as informações são verdadeiras.')
  if (e.consentimento !== true) throw erro('consentimento', 'Autorize o tratamento dos dados para continuar.')

  return {
    curso, nome, email, telefone,
    dados: { dataNascimento, bi, provincia, morada, ramo, posto, nip, unidade, anosServico, habilitacoes, areaFormacao, motivacao },
  }
}

export function validarAvaliacao({ estado, notas }) {
  const r = {}
  if (estado !== undefined) r.estado = escolha(estado, 'estado', 'Estado', ESTADOS_CANDIDATURA)
  if (notas !== undefined) r.notas = limparTexto(notas).slice(0, 4000)
  return r
}
