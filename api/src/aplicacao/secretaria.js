import { Conflito, ErroValidacao, NaoEncontrado } from '../dominio/comum/erros.js'
import { limparTexto } from '../dominio/comum/texto.js'
import {
  ESTADOS_MATRICULA, ESTADOS_PEDIDO, PERIODOS, TIPOS_CONTA, TIPOS_EVENTO, emailDaEscola, escolha, numeroConta, texto, validarAlocacao, validarEvento, validarHorario,
} from '../dominio/academico/regras.js'

const ANO_LETIVO = /^\d{4}\/\d{4}$/

/*
  Gestão académica feita no painel pela Repartição de Administração Escolar: contas do portal, turmas,
  matrículas, cadeiras (período e programa), alocação de docentes, pautas, horários, pedidos e avisos gerais.
  A palavra-passe inicial de cada conta é o próprio e-mail da Escola; o portal obriga a mudá-la
  na primeira entrada.
*/
export class ServicoSecretaria {
  constructor({ contas, academico, recursos, conteudos, pautas, notificacoes, copias, copiasRepo, privados, cifra, auditoria, relogio, dominioEmail, filtroHtml }) {
    Object.assign(this, { contas, academico, recursos, conteudos, pautas, notificacoes, copias, copiasRepo, privados, cifra, auditoria, relogio, dominioEmail, filtroHtml })
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
    const conta = await this.criarConta(ctx, { ...dados, tipo: 'estudante' })
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
          const conta = existente || await this.criarConta(ctx, { tipo: 'estudante', nome, email, dados })
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

  // ---------- cadeiras: dados, período e programa ----------

  #camposCadeira(dados) {
    const horas = Number(dados.horas ?? 0)
    if (!Number.isInteger(horas) || horas < 0 || horas > 1000) throw new ErroValidacao('Horas inválidas.', { campo: 'horas' })
    const codigo = texto(dados.codigo, 'codigo', 'Código', { min: 2, max: 20 }).toUpperCase()
    if (!/^[A-Z0-9-]+$/.test(codigo)) throw new ErroValidacao('O código só tem letras, números e hífens.', { campo: 'codigo' })
    return {
      codigo, horas,
      periodo: escolha(String(dados.periodo ?? '1'), 'periodo', 'Período', Object.keys(PERIODOS)),
      nome: texto(dados.nome, 'nome', 'Nome', { min: 3, max: 150 }),
      descricao: texto(dados.descricao, 'descricao', 'Descrição', { max: 2000, obrigatorio: false }),
    }
  }

  async #cadeira(id) {
    const c = await this.academico.cadeira(id)
    if (!c) throw new NaoEncontrado('Cadeira não encontrada.')
    return c
  }

  // a cadeira pode ser criada sem docentes; a alocação faz-se depois
  async criarCadeira(ctx, turmaId, dados) {
    ctx.actor.exigir('academico.gerir')
    const t = await this.academico.turma(turmaId)
    if (!t) throw new NaoEncontrado('Turma não encontrada.')
    const c = await this.academico.criarCadeira({ turmaId: t.id, ...this.#camposCadeira(dados) })
    await this.auditoria.registar(ctx, { acao: 'criar_cadeira', colecao: 'cadeiras', alvoId: c.id, alvoTitulo: `${c.nome} (${t.nome})` })
    return this.academico.cadeira(c.id)
  }

  async editarCadeira(ctx, id, dados) {
    ctx.actor.exigir('academico.gerir')
    const c = await this.#cadeira(id)
    await this.academico.atualizarCadeira(c.id, this.#camposCadeira({ ...c, ...dados }))
    await this.auditoria.registar(ctx, { acao: 'editar_cadeira', colecao: 'cadeiras', alvoId: c.id, alvoTitulo: c.nome })
    return this.academico.cadeira(c.id)
  }

  async apagarCadeira(ctx, id) {
    ctx.actor.exigir('academico.gerir')
    const c = await this.#cadeira(id)
    await this.academico.apagarCadeira(c.id)
    await this.auditoria.registar(ctx, { acao: 'apagar_cadeira', colecao: 'cadeiras', alvoId: c.id, alvoTitulo: c.nome })
  }

  // ficha completa de uma cadeira no painel (dados, docentes, horário)
  async cadeira(ctx, id) {
    ctx.actor.exigir('academico.ver')
    const c = await this.#cadeira(id)
    const [horarios, programaFicheiro] = await Promise.all([
      this.academico.horariosDasCadeiras([c.id]),
      c.programaFicheiroId ? this.academico.ficheiro(c.programaFicheiroId) : null,
    ])
    return { ...c, horarios, programaFicheiro: programaFicheiro && { id: programaFicheiro.id, nome: programaFicheiro.nome, tamanho: programaFicheiro.tamanho } }
  }

  /*
    Programa da cadeira: escrito no próprio portal (HTML filtrado) e/ou em documento (PDF, Word).
    removerFicheiro: true tira o documento.
  */
  async programa(ctx, id, { texto: html, removerFicheiro }, ficheiro) {
    let c
    try {
      ctx.actor.exigir('academico.gerir')
      c = await this.#cadeira(id)
    } catch (e) {
      if (ficheiro) this.privados.apagar(ficheiro.caminho)
      throw e
    }
    const mudanca = {}
    if (html !== undefined) {
      if (String(html).length > 200_000) throw new ErroValidacao('O programa é demasiado longo.', { campo: 'texto' })
      mudanca.programa = this.filtroHtml(String(html))
    }
    if (ficheiro) {
      if (!this.privados.confirmarTipo(ficheiro.caminho, ficheiro.tipo)) {
        this.privados.apagar(ficheiro.caminho)
        throw new ErroValidacao('O ficheiro não corresponde ao tipo indicado.', { campo: 'ficheiro' })
      }
      const ficheiroId = ficheiro.caminho.split(/[\\/]/).pop().split('.')[0]
      await this.academico.criarFicheiro({ id: ficheiroId, caminho: this.privados.relativo(ficheiro.caminho), nome: ficheiro.nome, tipo: ficheiro.tipo, tamanho: ficheiro.tamanho })
      mudanca.programaFicheiroId = ficheiroId
    } else if (removerFicheiro === true || removerFicheiro === 'true') {
      mudanca.programaFicheiroId = null
    }
    await this.academico.atualizarCadeira(c.id, mudanca)
    await this.auditoria.registar(ctx, { acao: 'programa_cadeira', colecao: 'cadeiras', alvoId: c.id, alvoTitulo: c.nome })
    return this.cadeira(ctx, c.id)
  }

  // ---------- novo ano letivo: copiar cadeiras ----------

  // cadeiras de onde se pode copiar (todas, das turmas mais recentes para as mais antigas)
  async origensDeCopia(ctx) {
    ctx.actor.exigir('academico.ver')
    return (await this.academico.todasCadeiras()).map((c) => ({ id: c.id, codigo: c.codigo, nome: c.nome, turma: c.turma }))
  }

  // copia os conteúdos de uma cadeira (de outro ano) para esta
  async copiarParaCadeira(ctx, destinoId, { origemId, docentes }) {
    ctx.actor.exigir('academico.gerir')
    const [origem, destino] = [await this.#cadeira(origemId), await this.#cadeira(destinoId)]
    return this.copias.copiar(ctx, origem, destino, { docentes: Boolean(docentes) })
  }

  /*
    Novo ano letivo: para cada cadeira da turma de origem, cria a cadeira na turma nova (se não existir,
    com o mesmo código) e copia os conteúdos. Cadeiras que já têm conteúdos ficam como estão.
  */
  async copiarTurma(ctx, turmaId, { origemTurmaId, docentes }) {
    ctx.actor.exigir('academico.gerir')
    const destino = await this.academico.turma(turmaId)
    const origem = await this.academico.turma(origemTurmaId)
    if (!destino || !origem) throw new NaoEncontrado('Turma não encontrada.')
    if (destino.id === origem.id) throw new ErroValidacao('Escolha outra turma de origem.', { campo: 'origemTurmaId' })
    const [deOrigem, existentes] = await Promise.all([this.academico.cadeirasDasTurmas([origem.id]), this.academico.cadeirasDasTurmas([destino.id])])
    const resultado = []
    for (const o of deOrigem) {
      let alvo = existentes.find((x) => x.codigo === o.codigo)
      let criada = false
      if (!alvo) {
        const nova = await this.academico.criarCadeira({ turmaId: destino.id, codigo: o.codigo, nome: o.nome, periodo: o.periodo, horas: o.horas, descricao: o.descricao })
        alvo = await this.academico.cadeira(nova.id)
        criada = true
      } else if (await this.copiasRepo.temConteudos(alvo.id)) {
        resultado.push({ codigo: o.codigo, nome: o.nome, criada: false, copiada: false, motivo: 'já tinha conteúdos' })
        continue
      }
      const resumo = await this.copias.copiar(ctx, o, alvo, { docentes: Boolean(docentes) })
      resultado.push({ codigo: o.codigo, nome: o.nome, criada, copiada: true, ...resumo })
    }
    return { turma: { id: destino.id, nome: destino.nome }, origem: { id: origem.id, nome: origem.nome }, cadeiras: resultado }
  }

  // ---------- alocação de docentes ----------

  // visão geral: cada docente com as suas cadeiras e horas; cadeiras sem regente
  async alocacao(ctx) {
    ctx.actor.exigir('academico.ver')
    const [docentes, cadeiras] = await Promise.all([this.contas.listar({ tipo: 'docente' }), this.academico.todasCadeiras({ soAtivas: true })])
    const porDocente = new Map(docentes.map((d) => [d.id, { docente: { id: d.id, nome: d.nome, numero: d.numero, email: d.email, ativo: d.ativo }, cadeiras: [], horas: 0 }]))
    for (const c of cadeiras) {
      for (const d of c.docentes) {
        const linha = porDocente.get(d.id)
        if (!linha) continue
        linha.cadeiras.push({ id: c.id, codigo: c.codigo, nome: c.nome, turma: c.turma?.nome, periodo: c.periodo, papel: d.papel, horas: d.horas })
        linha.horas += d.horas
      }
    }
    return {
      docentes: [...porDocente.values()].sort((a, b) => b.horas - a.horas || a.docente.nome.localeCompare(b.docente.nome)),
      cadeiras: cadeiras.map((c) => ({
        id: c.id, codigo: c.codigo, nome: c.nome, periodo: c.periodo, horas: c.horas, turma: c.turma, docentes: c.docentes,
        horasAlocadas: c.docentes.reduce((s, d) => s + d.horas, 0),
      })),
    }
  }

  async alocarDocentes(ctx, cadeiraId, lista) {
    ctx.actor.exigir('academico.gerir')
    const c = await this.#cadeira(cadeiraId)
    const docentes = validarAlocacao(lista)
    for (const d of docentes) {
      const conta = await this.contas.porId(d.docenteId)
      if (!conta || conta.tipo !== 'docente') throw new ErroValidacao('Escolha um docente.', { campo: 'docentes' })
    }
    await this.academico.definirDocentes(c.id, docentes)
    const nova = await this.academico.cadeira(c.id)
    await this.auditoria.registar(ctx, {
      acao: 'alocar_docentes', colecao: 'cadeiras', alvoId: c.id, alvoTitulo: c.nome,
      detalhes: { docentes: nova.docentes.map((d) => `${d.nome} (${d.papel}, ${d.horas} h)`) },
    })
    return nova
  }

  // ---------- pautas (a Administração Escolar também lança notas) ----------

  async pauta(ctx, cadeiraId) {
    ctx.actor.exigir('academico.ver')
    return this.pautas.pauta(await this.#cadeira(cadeiraId))
  }

  async gravarPauta(ctx, cadeiraId, linhas) {
    ctx.actor.exigir('academico.notas')
    return this.pautas.gravar(ctx, await this.#cadeira(cadeiraId), linhas)
  }

  async publicarNotas(ctx, cadeiraId, componentes) {
    ctx.actor.exigir('academico.notas')
    return this.pautas.publicar(ctx, await this.#cadeira(cadeiraId), componentes)
  }

  async definirComposicao(ctx, cadeiraId, { componente, itens }) {
    ctx.actor.exigir('academico.notas')
    return this.pautas.definirComposicao(ctx, await this.#cadeira(cadeiraId), componente, itens)
  }

  // ---------- calendário académico ----------

  // eventos gerais e das turmas (início de semestre, épocas de exames, feriados) e datas das provas das cadeiras
  listarEventos(ctx) {
    ctx.actor.exigir('academico.ver')
    return this.recursos.todosEventosGerais()
  }

  async eventosDaCadeira(ctx, cadeiraId) {
    ctx.actor.exigir('academico.ver')
    return this.recursos.eventosDaCadeira((await this.#cadeira(cadeiraId)).id)
  }

  async criarEvento(ctx, { turmaId, cadeiraId, ...dados }) {
    ctx.actor.exigir('academico.gerir')
    let turma = null
    let cadeira = null
    if (cadeiraId) cadeira = await this.#cadeira(cadeiraId)
    else if (turmaId) {
      turma = await this.academico.turma(turmaId)
      if (!turma) throw new ErroValidacao('Turma inválida.', { campo: 'turmaId' })
    }
    const e = await this.recursos.criarEvento({ cadeiraId: cadeira?.id ?? null, turmaId: turma?.id ?? null, ...validarEvento(dados, Object.keys(TIPOS_EVENTO)) })
    await this.auditoria.registar(ctx, { acao: 'marcar_evento', colecao: 'calendario', alvoId: e.id, alvoTitulo: `${e.titulo} (${e.data})` })
    return e
  }

  async apagarEvento(ctx, id) {
    ctx.actor.exigir('academico.gerir')
    const e = await this.recursos.evento(id)
    if (!e) throw new NaoEncontrado('Evento não encontrado.')
    await this.recursos.apagarEvento(e.id)
  }

  // ---------- horários ----------

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
    if (r.estado !== p.estado && ['pronto', 'recusado', 'em_tratamento'].includes(r.estado)) {
      const frase = { pronto: 'está pronto', recusado: 'foi recusado', em_tratamento: 'está a ser tratado' }[r.estado]
      await this.notificacoes?.notificar([p.estudanteId], { tipo: 'pedido', titulo: `O seu pedido "${p.tipo}" ${frase}`, texto: r.resposta || '', ligacao: '/pedidos' })
    }
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
    const para = turma ? (await this.academico.estudantesAtivosDaTurma(turma.id)).map((e) => e.id) : await this.academico.idsEstudantesAtivos()
    await this.notificacoes?.notificar(para, { tipo: 'aviso', titulo: `Administração Escolar: ${a.titulo}`, texto: a.texto.slice(0, 300), ligacao: '/avisos' })
    return a
  }

  async apagarAviso(ctx, id) {
    ctx.actor.exigir('academico.gerir')
    await this.academico.apagarAvisoGeral(id)
  }
}
