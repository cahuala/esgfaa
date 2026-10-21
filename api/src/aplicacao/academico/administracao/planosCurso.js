import { NaoEncontrado, ErroValidacao } from '../../../dominio/comum/erros.js'
import { FORMAS_AVALIACAO, FORMULAS, MODELOS_PLANO, TERMOS, TIPOS_AVALIACAO, validarPlano, verificarCargaHoraria } from '../../../dominio/academico/avaliacao/planoCurso.js'

/*
  Planos de curso da ESG (Administração Escolar): as regras de avaliação de cada curso num ano lectivo
  (blocos, coeficientes, ajuste do Comandante), os modelos dos planos 2026/2027 para carregar numa turma,
  a verificação da carga horária e a pauta geral pelo plano. As provas (TAI/TAG) e as notas de cada UC
  também se gerem daqui, como no portal.
*/
export class ServicoPlanosCurso {
  constructor(dependencias) {
    Object.assign(this, dependencias)
  }

  async listar(ctx) {
    ctx.actor.exigir('academico.ver')
    return { planos: await this.planosCurso.planos(), modelos: Object.fromEntries(Object.entries(MODELOS_PLANO).map(([k, m]) => [k, { nome: m.plano.nome, cadeiras: m.cadeiras.length }])), formulas: FORMULAS, termos: TERMOS, tipos: TIPOS_AVALIACAO, formas: FORMAS_AVALIACAO }
  }

  async guardar(ctx, id, dados) {
    ctx.actor.exigir('academico.gerir')
    const limpo = validarPlano(dados)
    const p = await this.planosCurso.guardarPlano(id ? Number(id) : null, limpo).catch((e) => {
      if (e?.code === 'P2002') throw new ErroValidacao('Já existe um plano para este curso e ano lectivo.', { campo: 'anoLetivo' })
      throw e
    })
    await this.auditoria.registar(ctx, { acao: id ? 'editar_plano_curso' : 'criar_plano_curso', colecao: 'planos_curso', alvoId: p.id, alvoTitulo: p.nome })
    return p
  }

  async apagar(ctx, id) {
    ctx.actor.exigir('academico.gerir')
    const p = await this.planosCurso.plano(id)
    if (!p) throw new NaoEncontrado('Plano não encontrado.')
    await this.planosCurso.apagarPlano(p.id)
    await this.auditoria.registar(ctx, { acao: 'apagar_plano_curso', colecao: 'planos_curso', alvoId: p.id, alvoTitulo: p.nome })
  }

  /*
    Carrega um modelo (ex.: o plano do 32.º CSCD 2026/2027) numa turma: cria o plano do curso e do ano
    lectivo da turma (se ainda não existir) e as UC com o bloco, as horas e os créditos. As UC que a turma
    já tem (pelo código) ficam com o bloco, as horas e os créditos do modelo.
  */
  async carregarModelo(ctx, turmaId, chave) {
    ctx.actor.exigir('academico.gerir')
    const m = MODELOS_PLANO[chave]
    if (!m) throw new ErroValidacao('Modelo desconhecido.', { campo: 'modelo' })
    const t = await this.academico.turma(turmaId)
    if (!t) throw new NaoEncontrado('Turma não encontrada.')
    let plano = await this.planosCurso.daTurma(t)
    if (!plano) plano = await this.planosCurso.guardarPlano(null, validarPlano({ ...m.plano, curso: t.curso, anoLetivo: t.anoLetivo }))
    const existentes = await this.academico.cadeirasDasTurmas([t.id])
    let criadas = 0
    let atualizadas = 0
    for (const c of m.cadeiras) {
      const dados = { bloco: c.bloco, creditos: c.creditos, horasContacto: c.horasContacto, horasNaoContacto: c.horasNaoContacto, horas: c.horasContacto + c.horasNaoContacto, tii: Boolean(c.tii) }
      const ja = existentes.find((x) => x.codigo === c.codigo)
      if (ja) { await this.academico.atualizarCadeira(ja.id, dados); atualizadas++ } else { await this.academico.criarCadeira({ turmaId: t.id, codigo: c.codigo, nome: c.nome, periodo: c.periodo, descricao: '', ...dados }); criadas++ }
    }
    await this.auditoria.registar(ctx, { acao: 'carregar_plano_curso', colecao: 'planos_curso', alvoId: plano.id, alvoTitulo: `${plano.nome} → ${t.nome}`, detalhes: { criadas, atualizadas } })
    return { plano, criadas, atualizadas }
  }

  // o plano da turma, as UC com os blocos e os avisos da carga horária
  async daTurma(ctx, turmaId) {
    ctx.actor.exigir('academico.ver')
    const t = await this.academico.turma(turmaId)
    if (!t) throw new NaoEncontrado('Turma não encontrada.')
    const [plano, cadeiras] = await Promise.all([this.planosCurso.daTurma(t), this.academico.cadeirasDasTurmas([t.id])])
    const ucs = cadeiras.map((c) => ({ id: c.id, codigo: c.codigo, nome: c.nome, periodo: c.periodo, bloco: c.bloco, creditos: c.creditos, horasContacto: c.horasContacto, horasNaoContacto: c.horasNaoContacto, tii: c.tii }))
    const avisos = verificarCargaHoraria(ucs)
    if (plano) for (const u of ucs) if (plano.blocos.length && !plano.blocos.some((b) => b.sigla === u.bloco)) avisos.push(`${u.codigo} ${u.nome}: sem bloco do plano.`)
    return { turma: t, plano, ucs, avisos, modelos: Object.fromEntries(Object.entries(MODELOS_PLANO).map(([k, x]) => [k, x.plano.nome])) }
  }

  async pautaGeral(ctx, turmaId) {
    ctx.actor.exigir('academico.ver')
    const t = await this.academico.turma(turmaId)
    if (!t) throw new NaoEncontrado('Turma não encontrada.')
    const r = await this.esg.pautaGeral(t)
    if (!r) throw new NaoEncontrado('Esta turma não tem plano de curso da ESG.')
    return { turma: t, ...r }
  }

  // ---------- provas e notas de uma UC (como o docente) ----------

  async #cadeira(id) {
    const c = await this.academico.cadeira(id)
    if (!c) throw new NaoEncontrado('Cadeira não encontrada.')
    return c
  }

  async criarProva(ctx, cadeiraId, dados) {
    ctx.actor.exigir('academico.notas')
    return this.esg.criarAvaliacao(ctx, await this.#cadeira(cadeiraId), dados)
  }

  async editarProva(ctx, cadeiraId, provaId, dados) {
    ctx.actor.exigir('academico.notas')
    return this.esg.editarAvaliacao(ctx, await this.#cadeira(cadeiraId), provaId, dados)
  }

  async apagarProva(ctx, cadeiraId, provaId) {
    ctx.actor.exigir('academico.notas')
    return this.esg.apagarAvaliacao(ctx, await this.#cadeira(cadeiraId), provaId)
  }

  async notasProva(ctx, cadeiraId, provaId, linhas) {
    ctx.actor.exigir('academico.notas')
    return this.esg.gravarNotas(ctx, await this.#cadeira(cadeiraId), provaId, linhas)
  }

  async publicarProva(ctx, cadeiraId, provaId, publicar) {
    ctx.actor.exigir('academico.notas')
    return this.esg.publicar(ctx, await this.#cadeira(cadeiraId), provaId, publicar)
  }
}
