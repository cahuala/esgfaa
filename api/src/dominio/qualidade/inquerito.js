import { Conflito, ErroValidacao } from '../comum/erros.js'
import { limparTexto } from '../comum/texto.js'
import { validarPerguntasOpiniao } from '../comum/opiniao.js'

/*
  Inquérito institucional (qualidade): opinião de estudantes e/ou docentes sobre a Escola,
  os serviços ou o curso. Sempre anónimo. Rascunho → lançado (visível a quem se destina) → fechado.
*/
export const PUBLICOS = { estudantes: 'Estudantes', docentes: 'Docentes', todos: 'Estudantes e docentes' }

const erro = (campo, mensagem) => new ErroValidacao(mensagem, { campo })
const texto = (v, campo, rotulo, { min = 1, max = 200, obrigatorio = true } = {}) => {
  const t = limparTexto(v)
  if (!t && !obrigatorio) return ''
  if (t.length < min || t.length > max) throw erro(campo, `${rotulo}: entre ${min} e ${max} caracteres.`)
  return t
}

// modelos prontos a usar (editáveis antes de lançar)
export const MODELOS = {
  servicos: {
    titulo: 'Satisfação com os serviços da Escola',
    descricao: 'A sua opinião ajuda a melhorar os serviços. As respostas são anónimas.',
    publico: 'todos',
    perguntas: [
      { tipo: 'escala', texto: 'A Repartição de Administração Escolar atende com rapidez e eficácia.' },
      { tipo: 'escala', texto: 'A biblioteca tem o acervo e o horário de que preciso.' },
      { tipo: 'escala', texto: 'As salas de aula e os equipamentos estão em boas condições.' },
      { tipo: 'escala', texto: 'O portal académico é fácil de usar e útil.' },
      { tipo: 'escala', texto: 'A informação da Escola chega a tempo (avisos, calendário, horários).' },
      { tipo: 'escolha', texto: 'Que serviço deve ser melhorado primeiro?', opcoes: ['Administração Escolar', 'Biblioteca', 'Instalações', 'Portal académico', 'Alimentação'] },
      { tipo: 'aberta', texto: 'Sugestões' },
    ],
  },
  curso: {
    titulo: 'Avaliação do curso',
    descricao: 'Avalie o curso que frequenta. As respostas são anónimas.',
    publico: 'estudantes',
    perguntas: [
      { tipo: 'escala', texto: 'Os objetivos do curso foram claros desde o início.' },
      { tipo: 'escala', texto: 'O plano de estudos está bem organizado.' },
      { tipo: 'escala', texto: 'A carga de trabalho foi adequada.' },
      { tipo: 'escala', texto: 'O curso prepara bem para as funções que vou desempenhar.' },
      { tipo: 'escala', texto: 'Satisfação global com o curso.' },
      { tipo: 'aberta', texto: 'O que deve ser mantido?' },
      { tipo: 'aberta', texto: 'O que deve ser mudado?' },
    ],
  },
}

export class InqueritoInstitucional {
  constructor(d) {
    Object.assign(this, { turmaIds: [], lancadoEm: null, descricao: '', ...d })
  }

  static validar(d, atual = null) {
    const r = {}
    if (d.titulo !== undefined || !atual) r.titulo = texto(d.titulo, 'titulo', 'Título', { min: 3, max: 200 })
    if (d.descricao !== undefined) r.descricao = texto(d.descricao, 'descricao', 'Descrição', { max: 2000, obrigatorio: false })
    if (d.perguntas !== undefined || !atual) r.perguntas = validarPerguntasOpiniao(d.perguntas)
    if (d.publico !== undefined || !atual) {
      if (!PUBLICOS[d.publico]) throw erro('publico', 'Escolha a quem se destina.')
      r.publico = d.publico
    }
    if (d.turmaIds !== undefined) r.turmaIds = [...new Set((d.turmaIds || []).map(Number).filter((n) => Number.isSafeInteger(n) && n > 0))]
    if (d.fecha !== undefined || !atual) {
      const f = new Date(d.fecha)
      if (!d.fecha || Number.isNaN(f.getTime())) throw erro('fecha', 'Indique até quando se responde.')
      r.fecha = f
    }
    return r
  }

  get lancado() {
    return Boolean(this.lancadoEm)
  }

  estado(agora) {
    if (!this.lancado) return 'rascunho'
    return new Date(this.fecha) > agora ? 'aberto' : 'fechado'
  }

  // depois de lançado só se muda a data de fecho (as perguntas ficam fixas)
  mudancasPermitidas(mudanca) {
    if (this.lancado && Object.keys(mudanca).some((k) => k !== 'fecha')) throw new Conflito('O inquérito já foi lançado: só pode mudar a data de fecho.')
    return mudanca
  }

  lancar(agora) {
    if (this.lancado) throw new Conflito('O inquérito já foi lançado.')
    if (new Date(this.fecha) <= agora) throw new ErroValidacao('A data de fecho já passou.', { campo: 'fecha' })
    this.lancadoEm = agora
    return this
  }

  // a conta é destinatária? turmas: as turmas ativas do estudante
  destinadoA(conta, turmas = []) {
    if (this.publico !== 'todos' && this.publico !== `${conta.tipo}s`) return false
    if (conta.tipo === 'estudante' && this.turmaIds.length) return turmas.some((t) => this.turmaIds.includes(t))
    return true
  }
}
