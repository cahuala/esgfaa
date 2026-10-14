import { Conflito, ErroValidacao, NaoEncontrado } from '../../dominio/comum/erros.js'
import { texto, validarNota } from '../../dominio/academico/regras.js'
import { distribuirAvaliacoes, faseWorkshop, notaDoPar, notaDosPares, validarWorkshop } from '../../dominio/academico/workshops.js'

/*
  Avaliação por pares na cadeira. O docente cria; os estudantes entregam, depois avaliam os
  trabalhos que lhes calharam; no fim cada um vê as avaliações que recebeu e a nota.
  A distribuição faz-se sozinha na primeira vez que alguém abre o workshop depois do fim da entrega.
*/
export class ServicoWorkshops {
  constructor({ workshops, academico, acesso, disponibilidade, privados, notificacoes, pautas, registos, relogio, aleatorio = Math.random }) {
    Object.assign(this, { workshops, academico, acesso, disponibilidade, privados, notificacoes, pautas, registos, relogio, aleatorio })
  }

  async #secaoDe(cadeiraId, secaoId) {
    if (secaoId === undefined || secaoId === null || secaoId === '' || secaoId === 'null') return null
    const s = await this.academico.secao(secaoId)
    if (!s || s.cadeiraId !== cadeiraId) throw new ErroValidacao('Capítulo inválido.', { campo: 'secaoId' })
    return s.id
  }

  async #doDocente(ctx, id) {
    const w = await this.workshops.workshop(id)
    if (!w) throw new NaoEncontrado('Avaliação por pares não encontrada.')
    const cadeira = await this.acesso.doDocente(ctx.conta, w.cadeiraId)
    return { w, cadeira }
  }

  async criar(ctx, cadeiraId, dados) {
    const c = await this.acesso.doDocente(ctx.conta, cadeiraId)
    const w = await this.workshops.criar({ cadeiraId: c.id, secaoId: await this.#secaoDe(c.id, dados.secaoId), ...validarWorkshop(dados) })
    await this.notificacoes?.notificar(await this.notificacoes.estudantesDaCadeira(c), {
      tipo: 'trabalho', titulo: `Avaliação por pares em ${c.nome}: ${w.titulo}`,
      texto: `Entregue até ${new Date(w.fimSubmissao).toLocaleString('pt-PT', { timeZone: 'Africa/Luanda', dateStyle: 'short', timeStyle: 'short' })}`,
      ligacao: `/cadeiras/${c.id}?atividade=workshop-${w.id}`,
    }, { excepto: ctx.conta.id })
    return w
  }

  async atualizar(ctx, id, dados) {
    const { w } = await this.#doDocente(ctx, id)
    const mudanca = validarWorkshop(dados, w)
    if (w.distribuidoEm && (mudanca.grelha || mudanca.avaliacoesPorPar !== undefined)) throw new Conflito('As avaliações já foram distribuídas: a grelha e o número de avaliações já não mudam.')
    return this.workshops.atualizar(w.id, mudanca)
  }

  async apagar(ctx, id) {
    const { w } = await this.#doDocente(ctx, id)
    await this.workshops.apagar(w.id)
  }

  // distribui as avaliações quando a entrega termina (uma só vez)
  async #distribuirSePreciso(w) {
    if (w.distribuidoEm || faseWorkshop(w, this.relogio.agora()) === 'submissao') return w
    const subs = await this.workshops.submissoes(w.id)
    const porAutor = Object.fromEntries(subs.map((s) => [s.estudanteId, s.id]))
    const pares = distribuirAvaliacoes(subs.map((s) => s.estudanteId), w.avaliacoesPorPar, this.aleatorio)
      .map((p) => ({ submissaoId: porAutor[p.autorId], avaliadorId: p.avaliadorId }))
    await this.workshops.distribuir(w.id, pares, this.relogio.agora())
    return this.workshops.workshop(w.id)
  }

  /*
    Docente: todas as submissões com as avaliações e as notas. Estudante: a sua submissão,
    as avaliações que tem de fazer e, no fim, as que recebeu (sem os nomes, se for anónimo).
  */
  async ver(ctx, id) {
    let w = await this.workshops.workshop(id)
    if (!w) throw new NaoEncontrado('Avaliação por pares não encontrada.')
    const cadeira = await this.acesso.acessivel(ctx.conta, w.cadeiraId).catch(() => { throw new NaoEncontrado('Avaliação por pares não encontrada.') })
    if (ctx.conta.tipo === 'estudante') await this.disponibilidade.exigir(cadeira.id, ctx.conta.id, 'workshop', w.id)
    w = await this.#distribuirSePreciso(w)
    const fase = faseWorkshop(w, this.relogio.agora())

    if (ctx.conta.tipo === 'docente') {
      const [subs, estudantes] = await Promise.all([this.workshops.submissoes(w.id), this.academico.estudantesAtivosDaTurma(cadeira.turmaId)])
      return {
        ...w, fase, totalEstudantes: estudantes.length,
        submissoes: subs.map((s) => ({ ...s, notaPares: notaDosPares(s.avaliacoes), nota: s.notaFinal ?? notaDosPares(s.avaliacoes) })),
        semEntrega: estudantes.filter((e) => !subs.some((s) => s.estudanteId === e.id)),
      }
    }

    await this.registos?.registar(ctx.conta, cadeira.id, 'workshop', w.id)
    const minha = await this.workshops.submissaoDe(w.id, ctx.conta.id)
    const aFazer = (await this.workshops.avaliacoesDe(w.id, ctx.conta.id)).map((a) => ({
      ...a, submissao: { ...a.submissao, estudante: w.anonimo ? null : a.submissao.estudante, estudanteId: undefined },
    }))
    const recebidas = fase === 'encerrado' && minha
      ? minha.avaliacoes.filter((a) => a.nota !== null).map((a) => ({ pontos: a.pontos, comentario: a.comentario, nota: a.nota }))
      : null
    return {
      ...w, fase, minha: minha && { ...minha, avaliacoes: undefined },
      avaliacoes: aFazer, recebidas,
      nota: fase === 'encerrado' && minha ? (minha.notaFinal ?? notaDosPares(minha.avaliacoes)) : null,
    }
  }

  async submeter(ctx, id, { texto: corpo }, ficheiro) {
    const largar = () => { if (ficheiro) this.privados.apagar(ficheiro.caminho) }
    try {
      this.acesso.soEstudante(ctx.conta)
      const w = await this.workshops.workshop(id)
      if (!w) throw new NaoEncontrado('Avaliação por pares não encontrada.')
      await this.acesso.acessivel(ctx.conta, w.cadeiraId).catch(() => { throw new NaoEncontrado('Avaliação por pares não encontrada.') })
      await this.disponibilidade.exigir(w.cadeiraId, ctx.conta.id, 'workshop', w.id)
      if (faseWorkshop(w, this.relogio.agora()) !== 'submissao') throw new Conflito('A entrega já terminou.')
      const t = texto(corpo, 'texto', 'Texto', { max: 50_000, obrigatorio: false })
      const anterior = await this.workshops.submissaoDe(w.id, ctx.conta.id)
      if (!t && !ficheiro && !anterior?.ficheiro) throw new ErroValidacao('Escreva o texto ou junte um ficheiro.', { campo: 'texto' })
      let ficheiroId
      if (ficheiro) {
        if (!this.privados.confirmarTipo(ficheiro.caminho, ficheiro.tipo)) throw new ErroValidacao(`O ficheiro "${ficheiro.nome}" não corresponde ao tipo indicado.`, { campo: 'ficheiro' })
        ficheiroId = ficheiro.caminho.split(/[\\/]/).pop().split('.')[0]
        await this.academico.criarFicheiro({ id: ficheiroId, caminho: this.privados.relativo(ficheiro.caminho), nome: ficheiro.nome, tipo: ficheiro.tipo, tamanho: ficheiro.tamanho, donoId: ctx.conta.id })
      }
      return await this.workshops.submeter({ workshopId: w.id, estudanteId: ctx.conta.id, texto: t, ficheiroId, entregueEm: this.relogio.agora() })
    } catch (e) {
      largar()
      throw e
    }
  }

  // o estudante avalia um trabalho que lhe calhou (pode corrigir até ao fim da avaliação)
  async avaliar(ctx, avaliacaoId, { pontos, comentario }) {
    this.acesso.soEstudante(ctx.conta)
    const a = await this.workshops.avaliacao(avaliacaoId)
    if (!a || a.avaliadorId !== ctx.conta.id) throw new NaoEncontrado('Avaliação não encontrada.')
    const w = await this.workshops.workshop(a.workshopId)
    if (faseWorkshop(w, this.relogio.agora()) !== 'avaliacao') throw new Conflito('O período de avaliação não está aberto.')
    let p = pontos
    if (typeof p === 'string') {
      try { p = JSON.parse(p) } catch { throw new ErroValidacao('Pontos inválidos.', { campo: 'pontos' }) }
    }
    const r = notaDoPar(w.grelha, p || {})
    const feita = await this.workshops.gravarAvaliacao(a.id, {
      pontos: r.pontos, nota: r.nota, feitaEm: this.relogio.agora(),
      comentario: texto(comentario, 'comentario', 'Comentário', { max: 5000, obrigatorio: false }),
    })
    const cadeira = await this.academico.cadeira(w.cadeiraId)
    await this.pautas?.sincronizar(cadeira) // a nota do colega pode contar para a pauta
    return feita
  }

  // o docente dá a nota final (substitui a média dos pares; null volta à média) e um comentário
  async notaFinal(ctx, submissaoId, { nota, comentario }) {
    const s = await this.workshops.submissao(submissaoId)
    if (!s) throw new NaoEncontrado('Submissão não encontrada.')
    const { cadeira } = await this.#doDocente(ctx, s.workshopId)
    await this.workshops.avaliarSubmissao(s.id, {
      notaFinal: nota === null || nota === '' || nota === undefined ? null : validarNota(nota),
      ...(comentario !== undefined ? { comentario: texto(comentario, 'comentario', 'Comentário', { max: 5000, obrigatorio: false }) } : {}),
    })
    await this.pautas?.sincronizar(cadeira)
    return this.ver(ctx, s.workshopId)
  }
}
