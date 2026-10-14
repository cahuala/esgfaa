import { Conflito, ErroValidacao, NaoEncontrado, SemPermissao } from '../../../dominio/comum/erros.js'
import { texto } from '../../../dominio/academico/comum/validacao.js'
import {
  MINIMO_RESPOSTAS_AVALIACAO, PERGUNTAS_AVALIACAO, RESULTADOS, limparRespostasInquerito, mediaGlobal, resultadosInquerito, validarSondagem,
} from '../../../dominio/academico/atividades/inqueritos.js'
import { eDuplicado } from '../../../infraestrutura/bd/prisma.js'

const data = (v, campo = 'fecha') => {
  if (v === null || v === undefined || v === '') return null
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) throw new ErroValidacao('Data inválida.', { campo })
  return d
}

/*
  Sondagens (do docente) e inquéritos de avaliação do docente (da Administração Escolar).
  Nas respostas anónimas a base de dados não guarda quem respondeu o quê.
*/
export class ServicoInqueritos {
  constructor({ inqueritos, academico, acesso, disponibilidade, notificacoes, registos, auditoria, relogio }) {
    Object.assign(this, { inqueritos, academico, acesso, disponibilidade, notificacoes, registos, auditoria, relogio })
  }

  #fechado(i) {
    return Boolean(i.fecha && new Date(i.fecha) <= this.relogio.agora())
  }

  async #doDocente(ctx, id) {
    const i = await this.inqueritos.inquerito(id)
    if (!i) throw new NaoEncontrado('Inquérito não encontrado.')
    const cadeira = await this.acesso.doDocente(ctx.conta, i.cadeiraId)
    return { i, cadeira }
  }

  async #secaoDe(cadeiraId, secaoId) {
    if (secaoId === undefined || secaoId === null || secaoId === '') return null
    const s = await this.academico.secao(secaoId)
    if (!s || s.cadeiraId !== cadeiraId) throw new ErroValidacao('Capítulo inválido.', { campo: 'secaoId' })
    return s.id
  }

  #dadosSondagem(d, atual = null) {
    const r = {}
    if (d.titulo !== undefined || !atual) r.titulo = texto(d.titulo, 'titulo', 'Título', { min: 3, max: 200 })
    if (d.descricao !== undefined) r.descricao = texto(d.descricao, 'descricao', 'Descrição', { max: 2000, obrigatorio: false })
    if (d.pergunta !== undefined || d.opcoes !== undefined || !atual) r.perguntas = validarSondagem(d)
    if (d.anonimo !== undefined) r.anonimo = Boolean(d.anonimo)
    if (d.mostrarResultados !== undefined) {
      if (!RESULTADOS.includes(d.mostrarResultados)) throw new ErroValidacao('Escolha quando os estudantes veem os resultados.', { campo: 'mostrarResultados' })
      r.resultados = d.mostrarResultados
    }
    if (d.fecha !== undefined) r.fecha = data(d.fecha)
    return r
  }

  // ---------- docente: sondagens ----------

  async criarSondagem(ctx, cadeiraId, dados) {
    const c = await this.acesso.doDocente(ctx.conta, cadeiraId)
    const i = await this.inqueritos.criar({ cadeiraId: c.id, tipo: 'sondagem', secaoId: await this.#secaoDe(c.id, dados.secaoId), ...this.#dadosSondagem(dados) })
    await this.#avisar(ctx, c, i, `Sondagem em ${c.nome}: ${i.titulo}`)
    return i
  }

  async atualizarSondagem(ctx, id, dados) {
    const { i } = await this.#doDocente(ctx, id)
    if (i.tipo !== 'sondagem') throw new SemPermissao('A avaliação do docente é gerida pela Administração Escolar.')
    const mudanca = this.#dadosSondagem(dados, i)
    if (i.respostas > 0 && (mudanca.perguntas || mudanca.anonimo !== undefined)) throw new Conflito('Já há respostas: a pergunta, as opções e o anonimato já não mudam.')
    return this.inqueritos.atualizar(i.id, mudanca)
  }

  async apagar(ctx, id) {
    const { i } = await this.#doDocente(ctx, id)
    if (i.tipo !== 'sondagem') throw new SemPermissao('A avaliação do docente é gerida pela Administração Escolar.')
    await this.inqueritos.apagar(i.id)
  }

  async #avisar(ctx, cadeira, i, titulo) {
    if (!this.notificacoes || !i.visivel) return
    if (i.secaoId && !(await this.academico.secao(i.secaoId))?.visivel) return
    await this.notificacoes.notificar(await this.notificacoes.estudantesDaCadeira(cadeira), {
      tipo: 'inquerito', titulo, texto: i.fecha ? `Responda até ${new Date(i.fecha).toLocaleString('pt-PT', { timeZone: 'Africa/Luanda', dateStyle: 'short', timeStyle: 'short' })}` : '',
      ligacao: `/cadeiras/${cadeira.id}?atividade=inquerito-${i.id}`,
    }, { excepto: ctx.conta?.id })
  }

  // ---------- ver e responder ----------

  /*
    Estudante: perguntas, se já respondeu (e a sua resposta, se não for anónimo) e os resultados quando pode vê-los.
    Docente: resultados (na avaliação, só a sua, depois do fecho e com respostas suficientes).
  */
  async ver(ctx, id) {
    const i = await this.inqueritos.inquerito(id)
    if (!i) throw new NaoEncontrado('Inquérito não encontrado.')
    const cadeira = await this.acesso.acessivel(ctx.conta, i.cadeiraId).catch(() => { throw new NaoEncontrado('Inquérito não encontrado.') })
    const fechado = this.#fechado(i)
    const base = { ...i, fechado, cadeira: { id: cadeira.id, nome: cadeira.nome, codigo: cadeira.codigo }, escala: i.tipo === 'avaliacao' }

    if (ctx.conta.tipo === 'docente') {
      if (i.tipo === 'avaliacao') {
        if (i.docenteId !== ctx.conta.id) return { ...base, aviso: 'Só o docente avaliado vê estes resultados.' }
        if (!fechado || i.respostas < MINIMO_RESPOSTAS_AVALIACAO) {
          return { ...base, aviso: `Os resultados aparecem depois do fecho e com pelo menos ${MINIMO_RESPOSTAS_AVALIACAO} respostas, para proteger o anonimato.` }
        }
      }
      const resultados = resultadosInquerito(i.perguntas, await this.inqueritos.respostas(i.id))
      const estudantes = await this.academico.estudantesDaCadeira(cadeira)
      const extra = i.tipo === 'sondagem' && !i.anonimo ? { porEstudante: await this.inqueritos.respostasComEstudante(i.id) } : {}
      return { ...base, resultados, media: mediaGlobal(resultados), estudantes: estudantes.length, ...extra }
    }

    await this.disponibilidade.exigir(cadeira.id, ctx.conta.id, 'inquerito', i.id)
    await this.registos?.registar(ctx.conta, cadeira.id, 'inquerito', i.id)
    const respondido = (await this.inqueritos.respondidos(ctx.conta.id, [i.id])).has(i.id)
    const minha = respondido && !i.anonimo ? await this.inqueritos.respostaDe(i.id, ctx.conta.id) : null
    const verResultados = i.tipo === 'sondagem' && (i.mostrarResultados === 'apos_responder' ? respondido || fechado : i.mostrarResultados === 'apos_fecho' ? fechado : false)
    return {
      ...base, respondido, minhaResposta: minha,
      podeResponder: !fechado && (!respondido || (i.tipo === 'sondagem' && !i.anonimo)),
      resultados: verResultados ? resultadosInquerito(i.perguntas, await this.inqueritos.respostas(i.id)) : null,
    }
  }

  async responder(ctx, id, respostas) {
    this.acesso.soEstudante(ctx.conta)
    const i = await this.inqueritos.inquerito(id)
    if (!i) throw new NaoEncontrado('Inquérito não encontrado.')
    await this.acesso.acessivel(ctx.conta, i.cadeiraId).catch(() => { throw new NaoEncontrado('Inquérito não encontrado.') })
    await this.disponibilidade.exigir(i.cadeiraId, ctx.conta.id, 'inquerito', i.id)
    if (this.#fechado(i)) throw new Conflito('Este inquérito já fechou.')
    const respondido = (await this.inqueritos.respondidos(ctx.conta.id, [i.id])).has(i.id)
    if (respondido && (i.anonimo || i.tipo !== 'sondagem')) throw new Conflito('Já respondeu a este inquérito.')
    const limpas = limparRespostasInquerito(i.perguntas, respostas)
    try {
      await this.inqueritos.responder(i, ctx.conta.id, limpas)
    } catch (e) {
      if (eDuplicado(e)) throw new Conflito('Já respondeu a este inquérito.')
      throw e
    }
    return this.ver(ctx, i.id)
  }

  // ---------- Administração Escolar: avaliação dos docentes ----------

  /*
    Lança o inquérito de avaliação em todas as cadeiras da turma, um por docente alocado.
    Não repete onde já existe. Devolve quantos criou.
  */
  async lancarAvaliacao(ctx, turmaId, { fecha, titulo }) {
    ctx.actor.exigir('academico.gerir')
    const turma = await this.academico.turma(turmaId)
    if (!turma) throw new NaoEncontrado('Turma não encontrada.')
    const limite = data(fecha)
    if (!limite || limite <= this.relogio.agora()) throw new ErroValidacao('Indique uma data de fecho no futuro.', { campo: 'fecha' })
    const base = texto(titulo || 'Avaliação do docente', 'titulo', 'Título', { min: 3, max: 120 })
    const cadeiras = await this.academico.cadeirasDasTurmas([turma.id])
    let criados = 0
    for (const c0 of cadeiras) {
      const c = await this.academico.cadeira(c0.id)
      for (const d of c.docentes) {
        if (await this.inqueritos.existeAvaliacao(c.id, d.id)) continue
        const i = await this.inqueritos.criar({
          cadeiraId: c.id, tipo: 'avaliacao', titulo: `${base}: ${d.nome}`, docenteId: d.id, anonimo: true, resultados: 'nunca', fecha: limite,
          descricao: 'Inquérito pedagógico anónimo: ninguém, nem o docente nem a Escola, consegue saber o que cada estudante respondeu. O docente só vê os resultados agregados depois do fecho.',
          perguntas: PERGUNTAS_AVALIACAO,
        })
        criados += 1
        await this.#avisar(ctx, c, i, `Avaliação do docente em ${c.nome}`)
      }
    }
    await this.auditoria.registar(ctx, { acao: 'lancar_avaliacao', colecao: 'turmas', alvoId: turma.id, alvoTitulo: `${turma.nome}: ${criados} inquérito(s)` })
    return { criados }
  }

  // resumo das avaliações de uma turma (Administração Escolar)
  async avaliacoesDaTurma(ctx, turmaId) {
    ctx.actor.exigir('academico.ver')
    const turma = await this.academico.turma(turmaId)
    if (!turma) throw new NaoEncontrado('Turma não encontrada.')
    const lista = await this.inqueritos.avaliacoesDaTurma(turma.id)
    const estudantes = (await this.academico.estudantesAtivosDaTurma(turma.id)).length
    return Promise.all(lista.map(async (i) => {
      const r = resultadosInquerito(i.perguntas, await this.inqueritos.respostas(i.id))
      return { id: i.id, cadeira: i.cadeira, docente: i.docente, fecha: i.fecha, fechado: this.#fechado(i), respostas: i.respostas, estudantes, media: mediaGlobal(r) }
    }))
  }

  async resultadosAdmin(ctx, id) {
    ctx.actor.exigir('academico.ver')
    const i = await this.inqueritos.inquerito(id)
    if (!i || i.tipo !== 'avaliacao') throw new NaoEncontrado('Inquérito não encontrado.')
    const resultados = resultadosInquerito(i.perguntas, await this.inqueritos.respostas(i.id))
    return { ...i, fechado: this.#fechado(i), resultados, media: mediaGlobal(resultados) }
  }

  async apagarAvaliacao(ctx, id) {
    ctx.actor.exigir('academico.gerir')
    const i = await this.inqueritos.inquerito(id)
    if (!i || i.tipo !== 'avaliacao') throw new NaoEncontrado('Inquérito não encontrado.')
    await this.inqueritos.apagar(i.id)
    await this.auditoria.registar(ctx, { acao: 'apagar_avaliacao', colecao: 'inqueritos', alvoId: i.id, alvoTitulo: i.titulo })
  }
}
