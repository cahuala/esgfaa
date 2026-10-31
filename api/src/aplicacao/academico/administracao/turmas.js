import { Conflito, ErroValidacao, NaoEncontrado } from '../../../dominio/comum/erros.js'
import { escolha, texto } from '../../../dominio/academico/comum/validacao.js'
import { termosDoPlano } from '../../../dominio/academico/avaliacao/planoCurso.js'
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
    // o ano fica configurado (datas dos semestres) se ainda não estava
    await this.anosLetivos?.garantir(anoLetivo)
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
    // os termos do curso (auditor/discente, TII/TFC), pelo plano de curso da turma
    const plano = this.planosCurso ? await this.planosCurso.daTurma(t) : null
    return { ...t, matriculas, cadeiras: cadeiras.map((c) => ({ ...c, horarios: horarios.filter((h) => h.cadeiraId === c.id) })), termos: termosDoPlano(plano, cadeiras), temPlano: Boolean(plano) }
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

  /*
    Passagem de ano: da turma de um ano curricular para a do ano seguinte do mesmo curso.
    Transita quem tem todas as cadeiras da turma aprovadas (ou dispensadas); não transita quem tem
    cadeiras reprovadas ou excluídas por faltas; fica por decidir quem ainda tem pautas por fechar
    (em curso, à espera de exame ou de recurso). Com executar = false só mostra o que aconteceria.
    Ao executar: matrícula na turma de destino e a da turma de origem passa a «concluída».
  */
  async transicao(ctx, turmaId, { destinoId, executar = false }) {
    ctx.actor.exigir('academico.gerir')
    const [t, d] = await Promise.all([this.academico.turma(turmaId), this.academico.turma(Number(destinoId))])
    if (!t) throw new NaoEncontrado('Turma não encontrada.')
    if (!d) throw new ErroValidacao('Escolha a turma do ano seguinte.', { campo: 'destinoId' })
    if (t.anoFinal) throw new ErroValidacao('É a turma de finalistas: o curso conclui-se em «Finalistas» (TFC e certificado), não passa a outro ano.')
    if (d.curso !== t.curso || d.anoCurricular !== t.anoCurricular + 1) throw new ErroValidacao(`A turma de destino tem de ser do mesmo curso e do ${t.anoCurricular + 1}.º ano.`, { campo: 'destinoId' })
    const [estudantes, cadeiras] = await Promise.all([this.academico.estudantesAtivosDaTurma(t.id), this.academico.cadeirasDasTurmas([t.id])])
    if (!cadeiras.length) throw new ErroValidacao('A turma não tem cadeiras.')
    const resultados = {}
    for (const c of cadeiras) {
      const pauta = await this.pautas.pauta(c)
      for (const l of pauta.linhas) (resultados[l.estudante.id] ??= []).push({ codigo: c.codigo, nome: c.nome, situacao: l.situacao, final: l.final })
    }
    const NOMES = { reprovado: 'reprovada', excluido: 'excluído por faltas', em_curso: 'em curso', exame: 'falta o exame', recurso: 'falta o recurso' }
    const linhas = estudantes.map((e) => {
      const r = resultados[e.id] ?? []
      const aprovadas = r.filter((x) => x.situacao === 'aprovado' || x.situacao === 'dispensado')
      const falhadas = r.filter((x) => x.situacao === 'reprovado' || x.situacao === 'excluido')
      const abertas = r.filter((x) => ['em_curso', 'exame', 'recurso'].includes(x.situacao))
      const decisao = falhadas.length ? 'nao_transita' : abertas.length || aprovadas.length < cadeiras.length ? 'por_decidir' : 'transita'
      return {
        estudante: { id: e.id, nome: e.nome, numero: e.numero }, decisao, aprovadas: aprovadas.length, cadeiras: cadeiras.length,
        pendentes: [...falhadas, ...abertas].map((x) => `${x.codigo} (${NOMES[x.situacao] ?? x.situacao})`),
      }
    })
    const resumo = { transita: linhas.filter((l) => l.decisao === 'transita').length, nao_transita: linhas.filter((l) => l.decisao === 'nao_transita').length, por_decidir: linhas.filter((l) => l.decisao === 'por_decidir').length }
    if (executar) {
      const daOrigem = new Map((await this.academico.matriculasDaTurma(t.id)).map((m) => [m.estudante.id, m]))
      for (const l of linhas.filter((x) => x.decisao === 'transita')) {
        try {
          await this.academico.matricular(l.estudante.id, d.id)
        } catch (e) {
          if (!(e instanceof Conflito) && e?.code !== 'P2002') throw e // já matriculado no destino
        }
        const m = daOrigem.get(l.estudante.id)
        if (m) await this.academico.alterarMatricula(m.id, 'concluida')
      }
      await this.auditoria.registar(ctx, { acao: 'passagem_de_ano', colecao: 'turmas', alvoId: t.id, alvoTitulo: `${t.nome} → ${d.nome}`, detalhes: resumo })
    }
    return { origem: { id: t.id, nome: t.nome, anoLetivo: t.anoLetivo, anoCurricular: t.anoCurricular }, destino: { id: d.id, nome: d.nome, anoLetivo: d.anoLetivo, anoCurricular: d.anoCurricular }, executada: Boolean(executar), resumo, linhas }
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
