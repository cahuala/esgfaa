import { Conflito, ErroValidacao, NaoEncontrado, SemPermissao } from '../../../dominio/comum/erros.js'
import { validarNota } from '../../../dominio/academico/avaliacao/nota.js'
import { texto } from '../../../dominio/academico/comum/validacao.js'
import { FORMAS_AVALIACAO, NOTA_MINIMA, TIPOS_AVALIACAO, mencao, recuperacaoPossivel, resultadoCurso, resultadoUc } from '../../../dominio/academico/avaliacao/planoCurso.js'

/*
  Avaliação pelos planos de curso da ESG (turmas cujo curso e ano lectivo têm um plano): as provas
  (TAI e TAG) de cada UC, as notas, a publicação, os pedidos de teste de recuperação e o resultado da
  UC e do curso (blocos, coeficientes, menção). Partilhado pelo portal (docentes e estudantes) e pelo
  painel (Administração Escolar). Quem chama já confirmou o acesso à cadeira.
*/
export class ServicoAvaliacaoEsg {
  constructor({ planos, academico, conclusao, auditoria, notificacoes, relogio }) {
    Object.assign(this, { planos, academico, conclusao, auditoria, notificacoes, relogio })
  }

  planoDaCadeira(cadeira) {
    return this.planos.daTurma(cadeira.turma)
  }

  async #tiis(turmaId) {
    return Object.fromEntries((await this.conclusao.tfcsDaTurma(turmaId)).map((t) => [t.estudanteId, t.nota === null || t.nota === undefined ? null : Number(t.nota)]))
  }

  // resultado de uma UC para um estudante (o TII: a nota do trabalho)
  #resultado(cadeira, plano, avaliacoes, notas, tii) {
    if (cadeira.tii) {
      const n = tii ?? null
      return { final: n, situacao: n === null ? 'em_curso' : n >= NOTA_MINIMA ? 'aprovado' : 'reprovado', mencao: n === null ? null : mencao(n), provas: [] }
    }
    return resultadoUc(avaliacoes, notas, { exigirTesteEscrito: plano?.exigirTesteEscrito !== false, agora: this.relogio.agora() })
  }

  // ---------- pauta da UC (docente e Administração Escolar) ----------

  async pauta(cadeira) {
    const plano = await this.planoDaCadeira(cadeira)
    const [avaliacoes, estudantes, tiis] = await Promise.all([this.planos.avaliacoes(cadeira.id), this.academico.estudantesDaPautaDaCadeira(cadeira), cadeira.tii ? this.#tiis(cadeira.turmaId) : {}])
    const notas = await this.planos.notas(avaliacoes.map((a) => a.id))
    return {
      modo: 'esg', cadeira, plano, tipos: TIPOS_AVALIACAO, formas: FORMAS_AVALIACAO,
      avaliacoes: avaliacoes.map((a) => ({ ...a, pedidos: Object.values(notas[a.id] ?? {}).filter((n) => n.recuperacaoPedidaEm).length })),
      linhas: estudantes.map((e) => {
        const minhas = Object.fromEntries(avaliacoes.map((a) => [a.id, notas[a.id]?.[e.id] ?? {}]))
        return { estudante: e, notas: minhas, ...this.#resultado(cadeira, plano, avaliacoes, minhas, tiis[e.id]) }
      }),
    }
  }

  #dadosAvaliacao(d) {
    if (!TIPOS_AVALIACAO[d.tipo]) throw new ErroValidacao('Escolha TAI ou TAG.', { campo: 'tipo' })
    const forma = FORMAS_AVALIACAO[d.forma] ? d.forma : d.tipo === 'TAG' ? 'trabalho' : 'teste'
    const data = d.data ? String(d.data).slice(0, 10) : null
    if (data && !/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new ErroValidacao('Data inválida.', { campo: 'data' })
    return { tipo: d.tipo, forma, titulo: texto(d.titulo, 'titulo', 'Título', { min: 2, max: 150 }), data }
  }

  async criarAvaliacao(ctx, cadeira, dados, utilizador) {
    if (cadeira.tii) throw new ErroValidacao('A UC do TII não tem provas: a nota é a do trabalho.')
    await this.#aberta(cadeira)
    const a = await this.planos.criarAvaliacao({ cadeiraId: cadeira.id, ...this.#dadosAvaliacao(dados) })
    await this.auditoria.registar(ctx, { acao: 'criar_prova', colecao: 'pautas', alvoId: cadeira.id, alvoTitulo: `${a.tipo} ${a.titulo} — ${cadeira.nome}`, utilizador })
    return this.pauta(cadeira)
  }

  // depois da proposta ao Conselho de Curso as notas da turma ficam fechadas (até se reabrir)
  async #aberta(cadeira) {
    const c = await this.planos.conselho(cadeira.turmaId)
    if (c.estado !== 'aberto') throw new Conflito(c.estado === 'homologada' ? 'A classificação da turma já foi homologada pelo Comandante: as notas estão fechadas.' : 'A classificação da turma já foi proposta ao Conselho de Curso: reabra-a para mudar notas.')
  }

  async #daCadeira(cadeira, avaliacaoId) {
    const a = await this.planos.avaliacao(avaliacaoId)
    if (!a || a.cadeiraId !== cadeira.id) throw new NaoEncontrado('Prova não encontrada.')
    return a
  }

  async editarAvaliacao(ctx, cadeira, avaliacaoId, dados, utilizador) {
    await this.#aberta(cadeira)
    const a = await this.#daCadeira(cadeira, avaliacaoId)
    await this.planos.atualizarAvaliacao(a.id, this.#dadosAvaliacao({ ...a, ...dados }))
    await this.auditoria.registar(ctx, { acao: 'editar_prova', colecao: 'pautas', alvoId: cadeira.id, alvoTitulo: `${a.tipo} ${a.titulo} — ${cadeira.nome}`, utilizador })
    return this.pauta(cadeira)
  }

  async apagarAvaliacao(ctx, cadeira, avaliacaoId, utilizador) {
    await this.#aberta(cadeira)
    const a = await this.#daCadeira(cadeira, avaliacaoId)
    if (a.publicadaEm) throw new Conflito('A prova já foi publicada: retire a publicação antes de a apagar.')
    await this.planos.apagarAvaliacao(a.id)
    await this.auditoria.registar(ctx, { acao: 'apagar_prova', colecao: 'pautas', alvoId: cadeira.id, alvoTitulo: `${a.tipo} ${a.titulo} — ${cadeira.nome}`, utilizador })
    return this.pauta(cadeira)
  }

  // linhas: [{ estudanteId, nota, recuperacao }]; a recuperação só num TAI com nota negativa
  async gravarNotas(ctx, cadeira, avaliacaoId, linhas, utilizador) {
    await this.#aberta(cadeira)
    const a = await this.#daCadeira(cadeira, avaliacaoId)
    const validos = new Set((await this.academico.estudantesDaPautaDaCadeira(cadeira)).map((e) => e.id))
    const vistos = new Set()
    const limpas = (Array.isArray(linhas) ? linhas : []).map((l) => {
      const estudanteId = Number(l.estudanteId)
      if (!validos.has(estudanteId)) throw new ErroValidacao('A pauta tem um estudante que não pertence à turma.')
      if (vistos.has(estudanteId)) throw new ErroValidacao('A pauta tem o mesmo estudante repetido.')
      vistos.add(estudanteId)
      const nota = validarNota(l.nota)
      const recuperacao = validarNota(l.recuperacao)
      if (recuperacao !== null && (a.tipo !== 'TAI' || nota === null || nota >= NOTA_MINIMA)) throw new ErroValidacao('O teste de recuperação só existe num TAI com nota negativa.', { campo: 'recuperacao' })
      return { estudanteId, nota, recuperacao }
    })
    await this.planos.gravarNotas(a.id, limpas)
    await this.auditoria.registar(ctx, { acao: 'lancar_notas', colecao: 'pautas', alvoId: cadeira.id, alvoTitulo: `${a.tipo} ${a.titulo} — ${cadeira.nome}`, detalhes: { estudantes: limpas.length }, utilizador })
    return this.pauta(cadeira)
  }

  // publica (ou esconde) as notas de uma prova; a publicação conta para o prazo da recuperação
  async publicar(ctx, cadeira, avaliacaoId, publicar, utilizador) {
    await this.#aberta(cadeira)
    const a = await this.#daCadeira(cadeira, avaliacaoId)
    if (publicar && !a.publicadaEm) {
      await this.planos.atualizarAvaliacao(a.id, { publicadaEm: this.relogio.agora() })
      await this.auditoria.registar(ctx, { acao: 'publicar_notas', colecao: 'pautas', alvoId: cadeira.id, alvoTitulo: `${a.tipo} ${a.titulo} — ${cadeira.nome}`, utilizador })
      await this.notificacoes?.notificar(await this.notificacoes.estudantesDaCadeira(cadeira), { tipo: 'notas', titulo: `Notas publicadas: ${a.tipo} ${a.titulo}`, texto: cadeira.nome, ligacao: '/notas' })
    } else if (!publicar && a.publicadaEm) {
      await this.planos.atualizarAvaliacao(a.id, { publicadaEm: null })
      await this.auditoria.registar(ctx, { acao: 'retirar_publicacao', colecao: 'pautas', alvoId: cadeira.id, alvoTitulo: `${a.tipo} ${a.titulo} — ${cadeira.nome}`, utilizador })
    }
    return this.pauta(cadeira)
  }

  // ---------- estudante ----------

  // o que o estudante vê numa UC: só as provas publicadas; o resultado só com todas publicadas
  async doEstudante(estudanteId, cadeira, { todas = false } = {}) {
    const plano = await this.planoDaCadeira(cadeira)
    const avaliacoes = (await this.planos.avaliacoes(cadeira.id)).filter((a) => todas || a.publicadaEm)
    const total = todas ? avaliacoes.length : (await this.planos.avaliacoes(cadeira.id)).length
    const notas = await this.planos.notasDoEstudante(estudanteId, avaliacoes.map((a) => a.id))
    const tii = cadeira.tii ? (await this.#tiis(cadeira.turmaId))[estudanteId] ?? null : null
    const r = this.#resultado(cadeira, plano, avaliacoes, notas, tii)
    const agora = this.relogio.agora()
    const provas = avaliacoes.map((a) => {
      const n = notas[a.id] ?? {}
      const rec = recuperacaoPossivel(a, n, agora)
      return { id: a.id, tipo: a.tipo, forma: a.forma, titulo: a.titulo, data: a.data, publicadaEm: a.publicadaEm, nota: n.nota ?? null, recuperacao: n.recuperacao ?? null, recuperacaoPedidaEm: n.recuperacaoPedidaEm ?? null, podePedirRecuperacao: rec.pode, prazoRecuperacao: a.tipo === 'TAI' ? rec.prazo : null }
    })
    // ainda há provas por publicar: a nota da UC não é a final
    const completo = cadeira.tii || (avaliacoes.length > 0 && avaliacoes.length === total)
    return { modo: 'esg', termo: plano?.termo ?? 'discente', provas, final: completo ? r.final : null, situacao: completo ? r.situacao : avaliacoes.length ? 'em_curso' : 'sem_provas', mencao: completo ? r.mencao : null, classificacao: completo ? r.mencao : null, tii: cadeira.tii }
  }

  async pedirRecuperacao(ctx, cadeira, avaliacaoId) {
    if (ctx.conta?.tipo !== 'estudante') throw new SemPermissao('Só o estudante pede o teste de recuperação.')
    const a = await this.#daCadeira(cadeira, avaliacaoId)
    const n = (await this.planos.notasDoEstudante(ctx.conta.id, [a.id]))[a.id]
    const r = recuperacaoPossivel(a, n, this.relogio.agora())
    if (!r.pode) throw new Conflito(r.motivo)
    await this.planos.pedirRecuperacao(a.id, ctx.conta.id, this.relogio.agora())
    await this.auditoria.registar(ctx, { acao: 'pedir_recuperacao', colecao: 'pautas', alvoId: cadeira.id, alvoTitulo: `${a.tipo} ${a.titulo} — ${cadeira.nome}`, utilizador: { id: ctx.conta.id, nome: ctx.conta.nome, email: ctx.conta.email } })
    const docentes = (cadeira.docentes ?? []).map((d) => d.id)
    if (docentes.length) await this.notificacoes?.notificar(docentes, { tipo: 'notas', titulo: `Pedido de teste de recuperação: ${a.tipo} ${a.titulo}`, texto: `${ctx.conta.nome} — ${cadeira.nome}`, ligacao: `/cadeiras/${cadeira.id}?separador=avaliacoes` })
    return this.doEstudante(ctx.conta.id, cadeira)
  }

  // ---------- curso (pauta geral, conclusão) ----------

  /*
    Resultado do curso de um estudante numa turma com plano: as UC da turma, os blocos, a nota final e a
    menção. publicadas = só o que o estudante já pode ver.
  */
  async resultadoDoEstudante(estudanteId, turma, { publicadas = false, ajuste = null } = {}) {
    const plano = await this.planos.daTurma(turma)
    if (!plano) return null
    const [conselho, classif] = await Promise.all([this.planos.conselho(turma.id), this.planos.classificacoes(turma.id)])
    const minha = classif[estudanteId] ?? { juizo: {}, ajuste: 0, distinto: false, fixado: null }
    // homologada: vale o que o Comandante homologou
    if (conselho.estado === 'homologada' && minha.fixado) {
      return { plano, ucs: minha.fixado.ucs ?? [], ...minha.fixado, distinto: minha.distinto, juizo: minha.juizo, conselho, homologado: true }
    }
    const cadeiras = await this.academico.cadeirasDasTurmas([turma.id])
    const ucs = []
    for (const c of cadeiras) {
      const r = await this.doEstudante(estudanteId, c, { todas: !publicadas })
      ucs.push({ id: c.id, codigo: c.codigo, nome: c.nome, bloco: c.bloco, creditos: c.creditos, tii: c.tii, final: r.final, situacao: r.situacao, mencao: r.mencao })
    }
    return { plano, ucs, ...resultadoCurso(plano, ucs, { ajuste: ajuste ?? minha.ajuste }), distinto: minha.distinto, juizo: minha.juizo, conselho, homologado: false }
  }

  async pautaGeral(turma) {
    const plano = await this.planos.daTurma(turma)
    if (!plano) return null
    const estudantes = await this.academico.estudantesDaPauta(turma.id)
    const linhas = []
    for (const e of estudantes) linhas.push({ estudante: e, ...(await this.resultadoDoEstudante(e.id, turma)) })
    return { plano, linhas }
  }
}
