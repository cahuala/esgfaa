import { Conflito, ErroValidacao, NaoEncontrado, SemPermissao } from '../../../dominio/comum/erros.js'
import { validarNota } from '../../../dominio/academico/avaliacao/nota.js'
import { texto } from '../../../dominio/academico/comum/validacao.js'
import { DECISOES_REVISAO, FORMAS_AVALIACAO, NOTA_MINIMA, TIPOS_AVALIACAO, decisaoRevisao, faltasDoCurso, mencao, recuperacaoPossivel, regrasPublicas, resultadoCurso, resultadoUc, revisaoPossivel } from '../../../dominio/academico/avaliacao/planoCurso.js'

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
    return resultadoUc(avaliacoes, notas, { exigirTesteEscrito: plano?.exigirTesteEscrito !== false, recuperacaoAutomatica: plano?.recuperacaoAutomatica === true, agora: this.relogio.agora() })
  }

  // ---------- pauta da UC (docente e Administração Escolar) ----------

  async pauta(cadeira) {
    const plano = await this.planoDaCadeira(cadeira)
    const [avaliacoes, estudantes, tiis] = await Promise.all([this.planos.avaliacoes(cadeira.id), this.academico.estudantesDaPautaDaCadeira(cadeira), cadeira.tii ? this.#tiis(cadeira.turmaId) : {}])
    const notas = await this.planos.notas(avaliacoes.map((a) => a.id))
    return {
      modo: 'esg', cadeira, plano, tipos: TIPOS_AVALIACAO, formas: FORMAS_AVALIACAO,
      avaliacoes: avaliacoes.map((a) => ({ ...a, pedidos: Object.values(notas[a.id] ?? {}).filter((n) => n.recuperacaoPedidaEm).length, revisoes: Object.values(notas[a.id] ?? {}).filter((n) => n.revisao && !n.revisao.decididaEm).length })),
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
    // peso da prova na nota da UC (%), como o plano da UC fixa (ex.: TAG 50 % e defesa individual 50 %)
    const p = d.peso === undefined || d.peso === null || d.peso === '' ? null : Number(String(d.peso).replace(',', '.'))
    if (p !== null && (!Number.isFinite(p) || p <= 0 || p > 100)) throw new ErroValidacao('Peso da prova: de 1 a 100 %.', { campo: 'peso' })
    return { tipo: d.tipo, forma, titulo: texto(d.titulo, 'titulo', 'Título', { min: 2, max: 150 }), data, peso: p }
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
      const rec = recuperacaoPossivel(a, n, agora, { automatica: plano?.recuperacaoAutomatica === true })
      return { id: a.id, tipo: a.tipo, forma: a.forma, titulo: a.titulo, data: a.data, publicadaEm: a.publicadaEm, nota: n.nota ?? null, recuperacao: n.recuperacao ?? null, recuperacaoPedidaEm: n.recuperacaoPedidaEm ?? null, podePedirRecuperacao: rec.pode, prazoRecuperacao: a.tipo === 'TAI' ? rec.prazo : null, recursoObrigatorio: Boolean(rec.automatica && a.tipo === 'TAI' && n.nota !== null && n.nota !== undefined && n.nota < NOTA_MINIMA && n.recuperacao == null), revisao: n.revisao ?? null, podePedirRevisao: revisaoPossivel(a, n).pode }
    })
    // ainda há provas por publicar: a nota da UC não é a final
    const completo = cadeira.tii || (avaliacoes.length > 0 && avaliacoes.length === total)
    return { modo: 'esg', termo: plano?.termo ?? 'discente', plano: regrasPublicas(plano), provas, final: completo ? r.final : null, situacao: completo ? r.situacao : avaliacoes.length ? 'em_curso' : 'sem_provas', ...(completo && r.motivo ? { motivo: r.motivo } : {}), mencao: completo ? r.mencao : null, classificacao: completo ? r.mencao : null, tii: cadeira.tii }
  }

  async pedirRecuperacao(ctx, cadeira, avaliacaoId) {
    if (ctx.conta?.tipo !== 'estudante') throw new SemPermissao('Só o estudante pede o teste de recuperação.')
    const a = await this.#daCadeira(cadeira, avaliacaoId)
    const n = (await this.planos.notasDoEstudante(ctx.conta.id, [a.id]))[a.id]
    const plano = await this.planoDaCadeira(cadeira)
    const r = recuperacaoPossivel(a, n, this.relogio.agora(), { automatica: plano?.recuperacaoAutomatica === true })
    if (!r.pode) throw new Conflito(r.motivo)
    await this.planos.pedirRecuperacao(a.id, ctx.conta.id, this.relogio.agora())
    await this.auditoria.registar(ctx, { acao: 'pedir_recuperacao', colecao: 'pautas', alvoId: cadeira.id, alvoTitulo: `${a.tipo} ${a.titulo} — ${cadeira.nome}`, utilizador: { id: ctx.conta.id, nome: ctx.conta.nome, email: ctx.conta.email } })
    const docentes = (cadeira.docentes ?? []).map((d) => d.id)
    if (docentes.length) await this.notificacoes?.notificar(docentes, { tipo: 'notas', titulo: `Pedido de teste de recuperação: ${a.tipo} ${a.titulo}`, texto: `${ctx.conta.nome} — ${cadeira.nome}`, ligacao: `/cadeiras/${cadeira.id}?separador=avaliacoes` })
    return this.doEstudante(ctx.conta.id, cadeira)
  }

  // revisão da prova: o estudante reclama por escrito; vai ao Director de Ensino (e o docente fica a saber)
  async pedirRevisao(ctx, cadeira, avaliacaoId, motivo) {
    if (ctx.conta?.tipo !== 'estudante') throw new SemPermissao('Só o estudante pede a revisão da prova.')
    await this.#aberta(cadeira)
    const a = await this.#daCadeira(cadeira, avaliacaoId)
    const n = (await this.planos.notasDoEstudante(ctx.conta.id, [a.id]))[a.id]
    const r = revisaoPossivel(a, n)
    if (!r.pode) throw new Conflito(r.motivo)
    const m = texto(motivo, 'motivo', 'Fundamentação do pedido', { min: 10, max: 3000 })
    await this.planos.pedirRevisao(a.id, ctx.conta.id, m, this.relogio.agora())
    await this.auditoria.registar(ctx, { acao: 'pedir_revisao_prova', colecao: 'pautas', alvoId: cadeira.id, alvoTitulo: `${a.tipo} ${a.titulo} — ${cadeira.nome}`, utilizador: { id: ctx.conta.id, nome: ctx.conta.nome, email: ctx.conta.email } })
    const docentes = (cadeira.docentes ?? []).map((d) => d.id)
    if (docentes.length) await this.notificacoes?.notificar(docentes, { tipo: 'notas', titulo: `Pedido de revisão: ${a.tipo} ${a.titulo}`, texto: `${ctx.conta.nome} — ${cadeira.nome}. Decide o Director de Ensino.`, ligacao: `/cadeiras/${cadeira.id}?separador=avaliacoes` })
    return this.doEstudante(ctx.conta.id, cadeira)
  }

  // os pedidos de revisão das UC de uma turma (pendentes primeiro)
  async revisoesDaTurma(turma) {
    const cadeiras = await this.academico.cadeirasDasTurmas([turma.id])
    const porId = new Map(cadeiras.map((c) => [c.id, c]))
    const l = await this.planos.revisoes(cadeiras.map((c) => c.id))
    return l.map((x) => ({ ...x, cadeira: { id: x.avaliacao.cadeiraId, codigo: porId.get(x.avaliacao.cadeiraId)?.codigo ?? '', nome: porId.get(x.avaliacao.cadeiraId)?.nome ?? '' }, decisaoNome: x.revisao.decisao ? DECISOES_REVISAO[x.revisao.decisao] : null }))
      .sort((a, b) => Boolean(a.revisao.decididaEm) - Boolean(b.revisao.decididaEm) || String(a.revisao.pedidaEm).localeCompare(String(b.revisao.pedidaEm)))
  }

  // o Director de Ensino delibera: a nova nota (pode subir, manter ou baixar) e a fundamentação
  async decidirRevisao(ctx, turma, { avaliacaoId, estudanteId, nota, fundamento }) {
    const cadeiras = await this.academico.cadeirasDasTurmas([turma.id])
    const a = await this.planos.avaliacao(avaliacaoId)
    const cadeira = cadeiras.find((c) => c.id === a?.cadeiraId)
    if (!cadeira) throw new NaoEncontrado('Prova não encontrada nesta turma.')
    await this.#aberta(cadeira)
    const n = (await this.planos.notasDoEstudante(estudanteId, [a.id]))[a.id]
    if (!n?.revisao) throw new NaoEncontrado('Não há pedido de revisão desta prova.')
    if (n.revisao.decididaEm) throw new Conflito('Este pedido de revisão já foi decidido.')
    const nova = Number(String(nota ?? '').replace(',', '.'))
    if (!Number.isFinite(nova) || nova < 0 || nova > 20) throw new ErroValidacao('A nota vai de 0 a 20.', { campo: 'nota' })
    const notaFinal = Math.round(nova * 100) / 100
    const decisao = decisaoRevisao(n.nota, notaFinal)
    const f = texto(fundamento, 'fundamento', 'Fundamentação da decisão', { min: 3, max: 3000 })
    await this.planos.decidirRevisao(a.id, estudanteId, { nota: notaFinal, notaAnterior: n.nota, decisao, decisor: ctx.actor?.nome ?? ctx.utilizador?.nome ?? '', fundamento: f, quando: this.relogio.agora() })
    await this.auditoria.registar(ctx, { acao: 'decidir_revisao_prova', colecao: 'pautas', alvoId: cadeira.id, alvoTitulo: `${a.tipo} ${a.titulo} — ${cadeira.nome}`, detalhes: { estudanteId, antes: n.nota, depois: notaFinal, decisao } })
    await this.notificacoes?.notificar([estudanteId], { tipo: 'notas', titulo: `Revisão da prova ${a.tipo} ${a.titulo}: ${DECISOES_REVISAO[decisao].toLowerCase()}`, texto: `${cadeira.nome}: ${String(n.nota).replace('.', ',')} → ${String(notaFinal).replace('.', ',')}`, ligacao: `/cadeiras/${cadeira.id}?separador=avaliacoes` })
    return this.revisoesDaTurma(turma)
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
    // faltas justificadas no curso todo, contra o limite do plano (10 % dos tempos previstos)
    const presencas = await this.academico.presencasDoEstudante(estudanteId, cadeiras.map((c) => c.id))
    const faltas = faltasDoCurso(presencas, cadeiras.reduce((t, c) => t + (c.horasContacto || 0), 0), plano.faltasMaximas)
    return { plano, ucs, ...resultadoCurso(plano, ucs, { ajuste: ajuste ?? minha.ajuste, faltas }), distinto: minha.distinto, juizo: minha.juizo, conselho, homologado: false }
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
