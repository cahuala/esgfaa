import { ErroValidacao, NaoEncontrado } from '../dominio/comum/erros.js'
import { limparTexto } from '../dominio/comum/texto.js'
import {
  ESTADOS_MATRICULA, ESTADOS_PEDIDO, TIPOS_CONTA, emailDaEscola, escolha, numeroConta, texto, validarHorario,
} from '../dominio/academico/regras.js'

const ANO_LETIVO = /^\d{4}\/\d{4}$/

/*
  Gestão académica feita pela Secretaria no painel: contas do portal, turmas, matrículas,
  cadeiras e docentes, horários, pedidos de documentos e avisos gerais.
  A palavra-passe inicial de cada conta é o próprio e-mail da Escola; o portal obriga a mudá-la
  na primeira entrada.
*/
export class ServicoSecretaria {
  constructor({ contas, academico, conteudos, privados, cifra, auditoria, relogio, dominioEmail }) {
    Object.assign(this, { contas, academico, conteudos, privados, cifra, auditoria, relogio, dominioEmail })
  }

  // ---------- contas do portal ----------

  listarContas(ctx, filtros) {
    ctx.actor.exigir('academico.ver')
    return this.contas.listar(filtros).then((l) => l.map((c) => ({ ...c.publico(), deveMudarSenha: c.deveMudarSenha })))
  }

  async #dadosConta(dados = {}) {
    const d = typeof dados === 'object' && dados && !Array.isArray(dados) ? dados : {}
    return Object.fromEntries(['posto', 'ramo', 'telefone', 'nip', 'departamento']
      .filter((k) => d[k] !== undefined && d[k] !== '')
      .map((k) => [k, limparTexto(d[k]).slice(0, 120)]))
  }

  async criarConta(ctx, { tipo, nome, email, dados }) {
    ctx.actor.exigir('academico.gerir')
    const t = escolha(tipo, 'tipo', 'Tipo de conta', TIPOS_CONTA)
    const e = emailDaEscola(email, this.dominioEmail)
    const n = texto(nome, 'nome', 'Nome completo', { min: 5, max: 150 })
    const ano = this.relogio.agora().getFullYear()
    // a palavra-passe inicial é o e-mail; o portal obriga a mudá-la na primeira entrada
    const senha = await this.cifra.cifrar(e)
    let conta
    for (let tentativa = 0; !conta; tentativa++) {
      try {
        const numero = numeroConta(t, ano, await this.contas.proximaSequencia(t, ano))
        conta = await this.contas.criar({ tipo: t, numero, nome: n, email: e, senha, dados: await this.#dadosConta(dados) })
      } catch (erro) {
        if (!/Número/.test(erro.message) || tentativa >= 3) throw erro
      }
    }
    await this.auditoria.registar(ctx, { acao: 'criar_conta_portal', colecao: 'contas_portal', alvoId: conta.id, alvoTitulo: `${conta.nome} (${conta.numero})`, detalhes: { tipo: t } })
    return { ...conta.publico(), deveMudarSenha: true }
  }

  async editarConta(ctx, id, { nome, email, ativo, dados }) {
    ctx.actor.exigir('academico.gerir')
    const c = await this.contas.porId(id)
    if (!c) throw new NaoEncontrado('Conta não encontrada.')
    if (nome !== undefined) c.nome = texto(nome, 'nome', 'Nome completo', { min: 5, max: 150 })
    if (email !== undefined) c.email = emailDaEscola(email, this.dominioEmail)
    if (dados !== undefined) c.dados = await this.#dadosConta(dados)
    if (ativo !== undefined && Boolean(ativo) !== c.ativo) {
      c.ativo = Boolean(ativo)
      if (!c.ativo) c.invalidarSessoes()
    }
    const g = await this.contas.guardar(c)
    await this.auditoria.registar(ctx, { acao: 'editar_conta_portal', colecao: 'contas_portal', alvoId: c.id, alvoTitulo: `${c.nome} (${c.numero})` })
    return { ...g.publico(), deveMudarSenha: g.deveMudarSenha }
  }

  // repõe a palavra-passe inicial (o e-mail) e termina as sessões abertas
  async reporSenha(ctx, id) {
    ctx.actor.exigir('academico.gerir')
    const c = await this.contas.porId(id)
    if (!c) throw new NaoEncontrado('Conta não encontrada.')
    c.mudarSenha(await this.cifra.cifrar(c.email))
    c.deveMudarSenha = true
    c.tentativasFalhadas = 0
    c.bloqueadoAte = null
    await this.contas.guardar(c)
    await this.auditoria.registar(ctx, { acao: 'repor_senha_portal', colecao: 'contas_portal', alvoId: c.id, alvoTitulo: `${c.nome} (${c.numero})` })
  }

  // ---------- turmas e matrículas ----------

  listarTurmas(ctx) {
    ctx.actor.exigir('academico.ver')
    return this.academico.listarTurmas()
  }

  async #cursoValido(curso) {
    const cursos = (await this.conteudos.listar('cursos')).map((c) => c.id)
    if (!cursos.includes(curso)) throw new ErroValidacao('Escolha um curso existente.', { campo: 'curso' })
    return curso
  }

  async criarTurma(ctx, { curso, anoLetivo, nome }) {
    ctx.actor.exigir('academico.gerir')
    if (!ANO_LETIVO.test(anoLetivo || '')) throw new ErroValidacao('Ano letivo no formato 2026/2027.', { campo: 'anoLetivo' })
    const [a, b] = anoLetivo.split('/').map(Number)
    if (b !== a + 1) throw new ErroValidacao('O ano letivo tem dois anos seguidos (ex.: 2026/2027).', { campo: 'anoLetivo' })
    const turma = await this.academico.criarTurma({ curso: await this.#cursoValido(curso), anoLetivo, nome: texto(nome, 'nome', 'Nome da turma', { min: 2, max: 80 }) })
    await this.auditoria.registar(ctx, { acao: 'criar_turma', colecao: 'turmas', alvoId: turma.id, alvoTitulo: turma.nome })
    return turma
  }

  async editarTurma(ctx, id, { nome, ativa }) {
    ctx.actor.exigir('academico.gerir')
    const t = await this.academico.turma(id)
    if (!t) throw new NaoEncontrado('Turma não encontrada.')
    return this.academico.atualizarTurma(t.id, {
      ...(nome !== undefined ? { nome: texto(nome, 'nome', 'Nome da turma', { min: 2, max: 80 }) } : {}),
      ...(ativa !== undefined ? { ativa: Boolean(ativa) } : {}),
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
    const conta = await this.criarConta(ctx, { ...dados, tipo: 'estudante' })
    await this.matricular(ctx, t.id, { estudanteId: conta.id })
    return conta
  }

  async alterarMatricula(ctx, id, { estado }) {
    ctx.actor.exigir('academico.gerir')
    const m = await this.academico.matricula(id)
    if (!m) throw new NaoEncontrado('Matrícula não encontrada.')
    const r = await this.academico.alterarMatricula(m.id, escolha(estado, 'estado', 'Estado', ESTADOS_MATRICULA))
    await this.auditoria.registar(ctx, { acao: 'alterar_matricula', colecao: 'matriculas', alvoId: m.id, detalhes: { de: m.estado, para: estado } })
    return r
  }

  // ---------- cadeiras e horários ----------

  async #docenteValido(docenteId) {
    if (docenteId === null || docenteId === undefined || docenteId === '') return null
    const d = await this.contas.porId(docenteId)
    if (!d || d.tipo !== 'docente') throw new ErroValidacao('Escolha um docente.', { campo: 'docenteId' })
    return d.id
  }

  #camposCadeira(dados) {
    const semestre = Number(dados.semestre ?? 1)
    const horas = Number(dados.horas ?? 0)
    if (!Number.isInteger(semestre) || semestre < 1 || semestre > 12) throw new ErroValidacao('Semestre inválido.', { campo: 'semestre' })
    if (!Number.isInteger(horas) || horas < 0 || horas > 1000) throw new ErroValidacao('Horas inválidas.', { campo: 'horas' })
    const codigo = texto(dados.codigo, 'codigo', 'Código', { min: 2, max: 20 }).toUpperCase()
    if (!/^[A-Z0-9-]+$/.test(codigo)) throw new ErroValidacao('O código só tem letras, números e hífens.', { campo: 'codigo' })
    return {
      codigo, semestre, horas,
      nome: texto(dados.nome, 'nome', 'Nome', { min: 3, max: 150 }),
      descricao: texto(dados.descricao, 'descricao', 'Descrição', { max: 2000, obrigatorio: false }),
    }
  }

  async criarCadeira(ctx, turmaId, dados) {
    ctx.actor.exigir('academico.gerir')
    const t = await this.academico.turma(turmaId)
    if (!t) throw new NaoEncontrado('Turma não encontrada.')
    const c = await this.academico.criarCadeira({ turmaId: t.id, ...this.#camposCadeira(dados), docenteId: await this.#docenteValido(dados.docenteId) })
    await this.auditoria.registar(ctx, { acao: 'criar_cadeira', colecao: 'cadeiras', alvoId: c.id, alvoTitulo: `${c.nome} (${t.nome})` })
    return c
  }

  async editarCadeira(ctx, id, dados) {
    ctx.actor.exigir('academico.gerir')
    const c = await this.academico.cadeira(id)
    if (!c) throw new NaoEncontrado('Cadeira não encontrada.')
    const r = await this.academico.atualizarCadeira(c.id, { ...this.#camposCadeira({ ...c, ...dados }), docenteId: await this.#docenteValido(dados.docenteId !== undefined ? dados.docenteId : c.docente?.id) })
    await this.auditoria.registar(ctx, { acao: 'editar_cadeira', colecao: 'cadeiras', alvoId: c.id, alvoTitulo: c.nome })
    return r
  }

  async apagarCadeira(ctx, id) {
    ctx.actor.exigir('academico.gerir')
    const c = await this.academico.cadeira(id)
    if (!c) throw new NaoEncontrado('Cadeira não encontrada.')
    await this.academico.apagarCadeira(c.id)
    await this.auditoria.registar(ctx, { acao: 'apagar_cadeira', colecao: 'cadeiras', alvoId: c.id, alvoTitulo: c.nome })
  }

  async criarHorario(ctx, cadeiraId, dados) {
    ctx.actor.exigir('academico.gerir')
    const c = await this.academico.cadeira(cadeiraId)
    if (!c) throw new NaoEncontrado('Cadeira não encontrada.')
    return this.academico.criarHorario({ cadeiraId: c.id, ...validarHorario(dados) })
  }

  async apagarHorario(ctx, id) {
    ctx.actor.exigir('academico.gerir')
    await this.academico.apagarHorario(id)
  }

  // ---------- pedidos de documentos ----------

  listarPedidos(ctx, { estado } = {}) {
    ctx.actor.exigir('academico.ver')
    return this.academico.pedidos({ estado })
  }

  async tratarPedido(ctx, id, { estado, resposta }, ficheiro) {
    try {
      ctx.actor.exigir('academico.gerir')
    } catch (e) {
      if (ficheiro) this.privados.apagar(ficheiro.caminho)
      throw e
    }
    const p = await this.academico.pedido(id)
    if (!p) {
      if (ficheiro) this.privados.apagar(ficheiro.caminho)
      throw new NaoEncontrado('Pedido não encontrado.')
    }
    let ficheiroId
    if (ficheiro) {
      if (!this.privados.confirmarTipo(ficheiro.caminho, ficheiro.tipo)) {
        this.privados.apagar(ficheiro.caminho)
        throw new ErroValidacao('O ficheiro não corresponde ao tipo indicado.', { campo: 'ficheiro' })
      }
      ficheiroId = ficheiro.caminho.split(/[\\/]/).pop().split('.')[0]
      await this.academico.criarFicheiro({ id: ficheiroId, caminho: this.privados.relativo(ficheiro.caminho), nome: ficheiro.nome, tipo: ficheiro.tipo, tamanho: ficheiro.tamanho })
    }
    const r = await this.academico.atualizarPedido(p.id, {
      ...(estado !== undefined ? { estado: escolha(estado, 'estado', 'Estado', ESTADOS_PEDIDO) } : {}),
      ...(resposta !== undefined ? { resposta: texto(resposta, 'resposta', 'Resposta', { max: 2000, obrigatorio: false }) } : {}),
      ...(ficheiroId ? { ficheiroId } : {}),
    })
    await this.auditoria.registar(ctx, { acao: 'tratar_pedido', colecao: 'pedidos', alvoId: p.id, alvoTitulo: p.tipo, detalhes: { de: p.estado, para: r.estado } })
    return r
  }

  async ficheiro(ctx, id) {
    ctx.actor.exigir('academico.ver')
    const f = await this.academico.ficheiro(id)
    if (!f) throw new NaoEncontrado('Ficheiro não encontrado.')
    return { caminho: this.privados.absoluto(f.caminho), nome: f.nome, tipo: f.tipo }
  }

  // ---------- avisos gerais ----------

  listarAvisos(ctx) {
    ctx.actor.exigir('academico.ver')
    return this.academico.todosAvisosGerais()
  }

  async criarAviso(ctx, { turmaId, titulo, texto: corpo }) {
    ctx.actor.exigir('academico.gerir')
    let turma = null
    if (turmaId) {
      turma = await this.academico.turma(turmaId)
      if (!turma) throw new ErroValidacao('Turma inválida.', { campo: 'turmaId' })
    }
    const a = await this.academico.criarAvisoGeral({
      turmaId: turma?.id ?? null,
      titulo: texto(titulo, 'titulo', 'Título', { min: 2, max: 200 }),
      texto: texto(corpo, 'texto', 'Texto', { min: 2, max: 5000 }),
    })
    await this.auditoria.registar(ctx, { acao: 'aviso_geral', colecao: 'avisos_gerais', alvoId: a.id, alvoTitulo: a.titulo })
    return a
  }

  async apagarAviso(ctx, id) {
    ctx.actor.exigir('academico.gerir')
    await this.academico.apagarAvisoGeral(id)
  }
}
