import { Conflito, ErroValidacao, NaoEncontrado } from '../../../dominio/comum/erros.js'
import { escolha, texto } from '../../../dominio/academico/comum/validacao.js'
import { ESTADOS_MATRICULA } from '../../../dominio/academico/matriculas/estados.js'
import { emailDaEscola } from '../../../dominio/academico/pessoas/contas.js'

const ANO_LETIVO = /^\d{4}\/\d{4}$/

// Turmas e matrículas (também a importação de estudantes de uma folha).
export class ServicoTurmas {
  constructor(dependencias) {
    Object.assign(this, dependencias)
  }

  listarTurmas(ctx) {
    ctx.actor.exigir('academico.ver')
    return this.academico.listarTurmas()
  }

  async #cursoValido(curso) {
    const cursos = (await this.conteudos.listar('cursos')).map((c) => c.id)
    if (!cursos.includes(curso)) throw new ErroValidacao('Escolha um curso existente.', { campo: 'curso' })
    return curso
  }

  #anoCurricular(valor) {
    const n = Number(valor ?? 1)
    if (!Number.isInteger(n) || n < 1 || n > 6) throw new ErroValidacao('Ano curricular entre 1 e 6.', { campo: 'anoCurricular' })
    return n
  }

  async criarTurma(ctx, { curso, anoLetivo, nome, anoCurricular }) {
    ctx.actor.exigir('academico.gerir')
    if (!ANO_LETIVO.test(anoLetivo || '')) throw new ErroValidacao('Ano letivo no formato 2026/2027.', { campo: 'anoLetivo' })
    const [a, b] = anoLetivo.split('/').map(Number)
    if (b !== a + 1) throw new ErroValidacao('O ano letivo tem dois anos seguidos (ex.: 2026/2027).', { campo: 'anoLetivo' })
    const turma = await this.academico.criarTurma({
      curso: await this.#cursoValido(curso), anoLetivo, anoCurricular: this.#anoCurricular(anoCurricular), nome: texto(nome, 'nome', 'Nome da turma', { min: 2, max: 80 }),
    })
    await this.auditoria.registar(ctx, { acao: 'criar_turma', colecao: 'turmas', alvoId: turma.id, alvoTitulo: turma.nome })
    return turma
  }

  async editarTurma(ctx, id, { nome, ativa, anoCurricular }) {
    ctx.actor.exigir('academico.gerir')
    const t = await this.academico.turma(id)
    if (!t) throw new NaoEncontrado('Turma não encontrada.')
    return this.academico.atualizarTurma(t.id, {
      ...(nome !== undefined ? { nome: texto(nome, 'nome', 'Nome da turma', { min: 2, max: 80 }) } : {}),
      ...(ativa !== undefined ? { ativa: Boolean(ativa) } : {}),
      ...(anoCurricular !== undefined ? { anoCurricular: this.#anoCurricular(anoCurricular) } : {}),
    })
  }

  async turma(ctx, id) {
    ctx.actor.exigir('academico.ver')
    const t = await this.academico.turma(id)
    if (!t) throw new NaoEncontrado('Turma não encontrada.')
    const [matriculas, cadeiras] = await Promise.all([this.academico.matriculasDaTurma(t.id), this.academico.cadeirasDasTurmas([t.id])])
    const horarios = await this.academico.horariosDasCadeiras(cadeiras.map((c) => c.id))
    return { ...t, matriculas, cadeiras: cadeiras.map((c) => ({ ...c, horarios: horarios.filter((h) => h.cadeiraId === c.id) })) }
  }

  async matricular(ctx, turmaId, { estudanteId }) {
    ctx.actor.exigir('academico.gerir')
    const t = await this.academico.turma(turmaId)
    if (!t) throw new NaoEncontrado('Turma não encontrada.')
    const e = await this.contas.porId(estudanteId)
    if (!e || e.tipo !== 'estudante') throw new ErroValidacao('Escolha um estudante.', { campo: 'estudanteId' })
    const m = await this.academico.matricular(e.id, t.id)
    await this.auditoria.registar(ctx, { acao: 'matricular', colecao: 'matriculas', alvoId: m.id, alvoTitulo: `${e.nome} → ${t.nome}` })
    return m
  }

  // matrícula de um estudante novo: cria a conta (e-mail da Escola) e matricula-o na turma
  async matricularNovo(ctx, turmaId, dados) {
    ctx.actor.exigir('academico.gerir')
    const t = await this.academico.turma(turmaId)
    if (!t) throw new NaoEncontrado('Turma não encontrada.')
    const conta = await this.servicoContas.criarConta(ctx, { ...dados, tipo: 'estudante' })
    await this.matricular(ctx, t.id, { estudanteId: conta.id })
    return conta
  }

  /*
    Importação de estudantes de uma folha (CSV/Excel lido no navegador): cria as contas que faltam
    e matricula todos na turma. Com simular, só diz o que faria a cada linha (pré-visualização).
    Uma linha com erro não impede as outras.
  */
  async importarEstudantes(ctx, turmaId, { linhas, simular = true }) {
    ctx.actor.exigir('academico.gerir')
    const t = await this.academico.turma(turmaId)
    if (!t) throw new NaoEncontrado('Turma não encontrada.')
    if (!Array.isArray(linhas) || !linhas.length) throw new ErroValidacao('A folha não tem estudantes.', { campo: 'linhas' })
    if (linhas.length > 500) throw new ErroValidacao('No máximo 500 estudantes de cada vez.', { campo: 'linhas' })
    const matriculados = new Set((await this.academico.matriculasDaTurma(t.id)).map((m) => m.estudante.id))
    const vistos = new Set()
    const resultado = []
    for (const [i, l] of linhas.entries()) {
      const linha = { linha: i + 1, nome: String(l.nome ?? '').trim(), email: String(l.email ?? '').trim().toLowerCase() }
      try {
        const email = emailDaEscola(l.email, this.dominioEmail)
        const nome = texto(l.nome, 'nome', 'Nome completo', { min: 5, max: 150 })
        if (vistos.has(email)) throw new ErroValidacao('E-mail repetido na folha.')
        vistos.add(email)
        const existente = await this.contas.porEmail(email)
        if (existente && existente.tipo !== 'estudante') throw new ErroValidacao('Este e-mail é de uma conta de docente.')
        let acao = existente ? (matriculados.has(existente.id) ? 'ja_matriculado' : 'matricular') : 'criar'
        let numero = existente?.numero ?? null
        if (!simular && acao !== 'ja_matriculado') {
          const dados = { posto: l.posto, ramo: l.ramo, nip: l.nip, telefone: l.telefone }
          const conta = existente || await this.servicoContas.criarConta(ctx, { tipo: 'estudante', nome, email, dados })
          numero = conta.numero
          await this.academico.matricular(conta.id, t.id).catch((e) => { if (e instanceof Conflito) acao = 'ja_matriculado'; else throw e })
        }
        resultado.push({ ...linha, nome, email, acao, numero })
      } catch (e) {
        if (!(e instanceof ErroValidacao)) throw e
        resultado.push({ ...linha, acao: 'erro', erro: e.message })
      }
    }
    const resumo = Object.fromEntries(['criar', 'matricular', 'ja_matriculado', 'erro'].map((k) => [k, resultado.filter((r) => r.acao === k).length]))
    if (!simular) await this.auditoria.registar(ctx, { acao: 'importar_estudantes', colecao: 'turmas', alvoId: t.id, alvoTitulo: t.nome, detalhes: resumo })
    return { simulacao: simular, resumo, linhas: resultado }
  }

  async alterarMatricula(ctx, id, { estado }) {
    ctx.actor.exigir('academico.gerir')
    const m = await this.academico.matricula(id)
    if (!m) throw new NaoEncontrado('Matrícula não encontrada.')
    const r = await this.academico.alterarMatricula(m.id, escolha(estado, 'estado', 'Estado', ESTADOS_MATRICULA))
    await this.auditoria.registar(ctx, { acao: 'alterar_matricula', colecao: 'matriculas', alvoId: m.id, detalhes: { de: m.estado, para: estado } })
    return r
  }
}
