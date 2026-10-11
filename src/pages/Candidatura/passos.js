// Passos e regras do formulário de candidatura (as mesmas da API, para avisar antes de enviar)

export const RAMOS = ['Exército', 'Força Aérea Nacional', 'Marinha de Guerra Angolana']
export const POSTOS = [
  'Tenente', 'Capitão', 'Major', 'Tenente-Coronel', 'Coronel',
  'Primeiro-Tenente', 'Capitão-Tenente', 'Capitão-de-Fragata', 'Capitão-de-Mar-e-Guerra', 'Outro',
]
export const HABILITACOES = ['Licenciatura', 'Mestrado', 'Doutoramento', 'Formação militar superior', 'Outra']

export const PASSOS = [
  { id: 'curso', titulo: 'Curso', campos: ['curso'] },
  { id: 'pessoais', titulo: 'Dados pessoais', campos: ['nome', 'dataNascimento', 'bi', 'email', 'telefone', 'provincia', 'morada'] },
  { id: 'militares', titulo: 'Situação militar', campos: ['ramo', 'posto', 'nip', 'unidade', 'anosServico', 'habilitacoes', 'areaFormacao', 'motivacao'] },
  { id: 'confirmacao', titulo: 'Confirmação', campos: ['declaracao', 'consentimento'] },
]

export const VAZIA = {
  curso: '', nome: '', dataNascimento: '', bi: '', email: '', telefone: '', provincia: '', morada: '',
  ramo: '', posto: '', nip: '', unidade: '', anosServico: '', habilitacoes: '', areaFormacao: '', motivacao: '',
  declaracao: false, consentimento: false, website: '',
}

// passo onde está um campo (para voltar a ele quando a API devolve um erro)
export const passoDoCampo = (campo) => Math.max(0, PASSOS.findIndex((p) => p.campos.includes(campo)))

const idade = (data, hoje) => {
  const [a, m, d] = data.split('-').map(Number)
  let anos = hoje.getFullYear() - a
  if (hoje.getMonth() + 1 < m || (hoje.getMonth() + 1 === m && hoje.getDate() < d)) anos -= 1
  return anos
}

/*
  Erros de um passo: { campo: 'mensagem' } (vazio se estiver tudo certo).
  cursos: identificadores aceites; hoje: data de referência para a idade.
*/
export function errosDoPasso(indice, f, { cursos = [], hoje = new Date() } = {}) {
  const e = {}
  const t = (v) => String(v ?? '').trim()
  switch (PASSOS[indice]?.id) {
    case 'curso':
      if (!cursos.includes(f.curso)) e.curso = 'Escolha o curso a que se quer candidatar.'
      break
    case 'pessoais': {
      if (t(f.nome).split(/\s+/).length < 2 || t(f.nome).length < 5) e.nome = 'Indique o nome completo (nome e apelido).'
      if (!/^\d{4}-\d{2}-\d{2}$/.test(f.dataNascimento)) e.dataNascimento = 'Indique a data de nascimento.'
      else {
        const anos = idade(f.dataNascimento, hoje)
        if (anos < 21 || anos > 70) e.dataNascimento = 'A idade deve estar entre 21 e 70 anos.'
      }
      if (!/^[0-9A-Za-z]{6,20}$/.test(t(f.bi))) e.bi = 'Número do bilhete de identidade inválido.'
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t(f.email))) e.email = 'E-mail inválido.'
      if (!/^\+?\d[\d\s-]{7,19}$/.test(t(f.telefone))) e.telefone = 'Número de telefone inválido.'
      if (t(f.provincia).length < 2) e.provincia = 'Indique a província.'
      break
    }
    case 'militares': {
      if (!RAMOS.includes(f.ramo)) e.ramo = 'Escolha o ramo.'
      if (!POSTOS.includes(f.posto)) e.posto = 'Escolha o posto.'
      if (!/^[0-9A-Za-z-]{4,20}$/.test(t(f.nip))) e.nip = 'NIP inválido (4 a 20 letras ou números).'
      if (t(f.unidade).length < 2) e.unidade = 'Indique a unidade ou órgão onde presta serviço.'
      const anos = Number(f.anosServico)
      if (f.anosServico === '' || !Number.isInteger(anos) || anos < 0 || anos > 45) e.anosServico = 'Número entre 0 e 45.'
      if (!HABILITACOES.includes(f.habilitacoes)) e.habilitacoes = 'Escolha as habilitações.'
      if (t(f.motivacao).length < 30) e.motivacao = 'Escreva pelo menos 30 caracteres.'
      break
    }
    case 'confirmacao':
      if (f.declaracao !== true) e.declaracao = 'Confirme que as informações são verdadeiras.'
      if (f.consentimento !== true) e.consentimento = 'Autorize o tratamento dos dados.'
      break
    default:
  }
  return e
}

// dados prontos para a API (números como números)
export const paraEnvio = (f) => ({ ...f, anosServico: Number(f.anosServico) })
