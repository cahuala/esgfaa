import { Conflito, ErroValidacao, NaoEncontrado } from '../../../dominio/comum/erros.js'
import { escolha, texto } from '../../../dominio/academico/comum/validacao.js'
import { ESTADOS_MATRICULA } from '../../../dominio/academico/matriculas/estados.js'

const ANO_LETIVO = /^\d{4}\/\d{4}$/

// Turmas e matrículas: a Administração Escolar matricula estudantes já registados pelo Pessoal e Quadros.
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

  async editarTurma(ctx, id, { nome, ativa, anoCurricular, anoFinal }) {
    ctx.actor.exigir('academico.gerir')
    const t = await this.academico.turma(id)
    if (!t) throw new NaoEncontrado('Turma não encontrada.')
    return this.academico.atualizarTurma(t.id, {
      ...(nome !== undefined ? { nome: texto(nome, 'nome', 'Nome da turma', { min: 2, max: 80 }) } : {}),
      ...(ativa !== undefined ? { ativa: Boolean(ativa) } : {}),
      ...(anoCurricular !== undefined ? { anoCurricular: this.#anoCurricular(anoCurricular) } : {}),
      ...(anoFinal !== undefined ? { anoFinal: Boolean(anoFinal) } : {}),
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

  // matricula vários estudantes já registados (escolhidos da lista do Pessoal e Quadros)
  async matricularVarios(ctx, turmaId, { estudanteIds }) {
    ctx.actor.exigir('academico.gerir')
    const t = await this.academico.turma(turmaId)
    if (!t) throw new NaoEncontrado('Turma não encontrada.')
    const ids = [...new Set((estudanteIds || []).map(Number))]
    if (!ids.length || ids.length > 300) throw new ErroValidacao('Escolha de 1 a 300 estudantes.', { campo: 'estudanteIds' })
    let matriculados = 0
    for (const id of ids) {
      const e = await this.contas.porId(id)
      if (!e || e.tipo !== 'estudante') throw new ErroValidacao('A lista tem quem não é estudante registado.', { campo: 'estudanteIds' })
      try {
        await this.academico.matricular(e.id, t.id)
        matriculados += 1
      } catch (erro) {
        if (!(erro instanceof Conflito)) throw erro
      }
    }
    await this.auditoria.registar(ctx, { acao: 'matricular', colecao: 'matriculas', alvoId: t.id, alvoTitulo: `${matriculados} estudante(s) → ${t.nome}` })
    return { matriculados, jaMatriculados: ids.length - matriculados }
  }

  /*
    Matrícula a partir de uma folha (CSV/Excel): só estudantes já registados pelo Pessoal e Quadros
    (encontrados pelo e-mail ou pelo número). Com simular, só diz o que faria a cada linha.
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
      const linha = { linha: i + 1, nome: String(l.nome ?? '').trim(), email: String(l.email ?? '').trim().toLowerCase(), numero: String(l.numero ?? '').trim() }
      try {
        const conta = linha.email ? await this.contas.porEmail(linha.email) : linha.numero ? await this.contas.porNumero(linha.numero) : null
        if (!linha.email && !linha.numero) throw new ErroValidacao('Falta o e-mail ou o número de estudante.')
        if (!conta) throw new ErroValidacao('Não está registado: o registo é feito pelo Pessoal e Quadros.')
        if (conta.tipo !== 'estudante') throw new ErroValidacao('Esta conta é de um docente.')
        if (vistos.has(conta.id)) throw new ErroValidacao('Estudante repetido na folha.')
        vistos.add(conta.id)
        let acao = matriculados.has(conta.id) ? 'ja_matriculado' : 'matricular'
        if (!simular && acao === 'matricular') {
          await this.academico.matricular(conta.id, t.id).catch((e) => { if (e instanceof Conflito) acao = 'ja_matriculado'; else throw e })
        }
        resultado.push({ ...linha, nome: conta.nome, email: conta.email, numero: conta.numero, acao })
      } catch (e) {
        if (!(e instanceof ErroValidacao)) throw e
        resultado.push({ ...linha, acao: 'erro', erro: e.message })
      }
    }
    const resumo = Object.fromEntries(['matricular', 'ja_matriculado', 'erro'].map((k) => [k, resultado.filter((r) => r.acao === k).length]))
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
