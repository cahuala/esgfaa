import { Conflito, ErroValidacao, NaoEncontrado } from '../../../dominio/comum/erros.js'
import { ESCALA_JUIZO, ESTADOS_CONSELHO, FACTORES_JUIZO, juizoCompleto, podeTerDistinto, validarJuizo } from '../../../dominio/academico/avaliacao/conselho.js'
import { texto } from '../../../dominio/academico/comum/validacao.js'

/*
  Conselho de Curso e homologação de uma turma com plano de curso da ESG:
  - o Director de Ensino (academico.conselho) faz o juízo ampliativo de cada auditor/discente e propõe as
    classificações; a proposta fixa o resultado de cada um e fecha as notas da turma;
  - o Conselho de Curso confirma (acta e data), também pelo Director de Ensino;
  - o Comandante (academico.homologar) homologa, atribui o DISTINTO ao melhor e, se o plano o prever, o
    ajuste da média final; o certificado do curso só sai depois da homologação, com a nota homologada.
  Reabrir volta ao início (fica no registo de actividades).
*/
export class ServicoConselhoCurso {
  constructor(dependencias) {
    Object.assign(this, dependencias)
  }

  async #turmaComPlano(turmaId) {
    const t = await this.academico.turma(turmaId)
    if (!t) throw new NaoEncontrado('Turma não encontrada.')
    const plano = await this.planosCurso.daTurma(t)
    if (!plano) throw new NaoEncontrado('Esta turma não tem plano de curso da ESG.')
    return { t, plano }
  }

  async #linhas(t) {
    const estudantes = await this.academico.estudantesDaPauta(t.id)
    const linhas = []
    for (const e of estudantes) {
      const r = await this.esg.resultadoDoEstudante(e.id, t)
      linhas.push({ estudante: e, estudanteId: e.id, final: r.final, media: r.media, mencao: r.mencao, concluido: r.concluido, emFalta: r.emFalta, blocos: r.blocos, ajuste: r.ajuste ?? 0, distinto: r.distinto, juizo: r.juizo, juizoCompleto: juizoCompleto(r.juizo), homologado: r.homologado, ucs: r.ucs })
    }
    return linhas
  }

  async estado(ctx, turmaId) {
    ctx.actor.exigir('academico.ver')
    const { t, plano } = await this.#turmaComPlano(turmaId)
    const [conselho, linhas] = await Promise.all([this.planosCurso.conselho(t.id), this.#linhas(t)])
    return {
      turma: t, plano, conselho: { ...conselho, estadoNome: ESTADOS_CONSELHO[conselho.estado] }, factores: FACTORES_JUIZO, escala: ESCALA_JUIZO,
      linhas: linhas.map((l) => ({ ...l, podeDistinto: podeTerDistinto(linhas, l.estudanteId), ucs: undefined })),
    }
  }

  async #exigirEstado(t, ...estados) {
    const c = await this.planosCurso.conselho(t.id)
    if (!estados.includes(c.estado)) throw new Conflito(`A turma está «${ESTADOS_CONSELHO[c.estado]}»: este passo não se aplica agora.`)
    return c
  }

  async #estudante(t, estudanteId) {
    const e = (await this.academico.estudantesDaPauta(t.id)).find((x) => x.id === Number(estudanteId))
    if (!e) throw new NaoEncontrado('Estudante não encontrado nesta turma.')
    return e
  }

  // juízo ampliativo (Director de Ensino): antes da homologação
  async guardarJuizo(ctx, turmaId, estudanteId, dados) {
    ctx.actor.exigir('academico.conselho')
    const { t } = await this.#turmaComPlano(turmaId)
    await this.#exigirEstado(t, 'aberto', 'proposta')
    const e = await this.#estudante(t, estudanteId)
    await this.planosCurso.guardarClassificacao(t.id, e.id, { juizo: validarJuizo(dados) })
    await this.auditoria.registar(ctx, { acao: 'juizo_ampliativo', colecao: 'conselho_curso', alvoId: t.id, alvoTitulo: `${e.nome} — ${t.nome}` })
    return this.estado(ctx, t.id)
  }

  // ajuste da média final (Comandante, ouvido o Conselho): só nos planos que o prevêem
  async guardarAjuste(ctx, turmaId, estudanteId, ajuste) {
    ctx.actor.exigir('academico.homologar')
    const { t, plano } = await this.#turmaComPlano(turmaId)
    if (!plano.ajusteMaximo) throw new ErroValidacao('Este plano de curso não prevê ajuste da média final.')
    await this.#exigirEstado(t, 'confirmada')
    const n = Number(String(ajuste ?? 0).replace(',', '.'))
    if (!Number.isFinite(n) || Math.abs(n) > plano.ajusteMaximo) throw new ErroValidacao(`O ajuste vai de −${plano.ajusteMaximo} a +${plano.ajusteMaximo}.`, { campo: 'ajuste' })
    const e = await this.#estudante(t, estudanteId)
    await this.planosCurso.guardarClassificacao(t.id, e.id, { ajuste: Math.round(n * 100) / 100 })
    await this.auditoria.registar(ctx, { acao: 'ajuste_media', colecao: 'conselho_curso', alvoId: t.id, alvoTitulo: `${e.nome} — ${t.nome}`, detalhes: { ajuste: n } })
    return this.estado(ctx, t.id)
  }

  // fixa o resultado de cada um (o que se propôs, confirmou ou homologou)
  async #fixar(t, distintos = null) {
    for (const l of await this.#linhas(t)) {
      const fixado = { final: l.final, media: l.media, mencao: l.mencao, concluido: l.concluido, emFalta: l.emFalta, blocos: l.blocos, ajuste: l.ajuste, ucs: l.ucs }
      await this.planosCurso.guardarClassificacao(t.id, l.estudanteId, { fixado, ...(distintos ? { distinto: distintos.includes(l.estudanteId) } : {}) })
    }
  }

  async propor(ctx, turmaId) {
    ctx.actor.exigir('academico.conselho')
    const { t } = await this.#turmaComPlano(turmaId)
    await this.#exigirEstado(t, 'aberto')
    const linhas = await this.#linhas(t)
    const semJuizo = linhas.filter((l) => !l.juizoCompleto)
    if (semJuizo.length) throw new ErroValidacao(`Falta o juízo ampliativo completo de: ${semJuizo.slice(0, 5).map((l) => l.estudante.nome).join(', ')}${semJuizo.length > 5 ? '…' : ''}.`)
    await this.#fixar(t)
    await this.planosCurso.guardarConselho(t.id, { estado: 'proposta', propostaPor: ctx.actor.nome || '', propostaEm: this.relogio.agora() })
    await this.auditoria.registar(ctx, { acao: 'propor_classificacoes', colecao: 'conselho_curso', alvoId: t.id, alvoTitulo: t.nome })
    return this.estado(ctx, t.id)
  }

  async confirmar(ctx, turmaId, { acta, dataConselho }) {
    ctx.actor.exigir('academico.conselho')
    const { t } = await this.#turmaComPlano(turmaId)
    await this.#exigirEstado(t, 'proposta')
    const data = String(dataConselho ?? '').slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new ErroValidacao('Indique a data do Conselho de Curso.', { campo: 'dataConselho' })
    await this.#fixar(t)
    await this.planosCurso.guardarConselho(t.id, { estado: 'confirmada', acta: texto(acta, 'acta', 'N.º da acta', { min: 1, max: 60 }), dataConselho: data, confirmadaPor: ctx.actor.nome || '', confirmadaEm: this.relogio.agora() })
    await this.auditoria.registar(ctx, { acao: 'confirmar_conselho_curso', colecao: 'conselho_curso', alvoId: t.id, alvoTitulo: t.nome })
    return this.estado(ctx, t.id)
  }

  async homologar(ctx, turmaId, { distinto = [] } = {}) {
    ctx.actor.exigir('academico.homologar')
    const { t } = await this.#turmaComPlano(turmaId)
    await this.#exigirEstado(t, 'confirmada')
    const linhas = await this.#linhas(t)
    const ids = [...new Set((Array.isArray(distinto) ? distinto : []).map(Number))]
    if (ids.length > 1) throw new ErroValidacao('O DISTINTO atribui-se a um só (em caso de igualdade, ao proposto pelo Director de Ensino).')
    for (const id of ids) if (!podeTerDistinto(linhas, id)) throw new ErroValidacao('O DISTINTO só se atribui a quem concluiu o curso com a melhor nota final.')
    await this.#fixar(t, ids)
    await this.planosCurso.guardarConselho(t.id, { estado: 'homologada', homologadaPor: ctx.actor.nome || '', homologadaEm: this.relogio.agora() })
    await this.auditoria.registar(ctx, { acao: 'homologar_classificacoes', colecao: 'conselho_curso', alvoId: t.id, alvoTitulo: t.nome, detalhes: { distinto: ids } })
    return this.estado(ctx, t.id)
  }

  // volta a «em avaliação»: depois de homologada só o Comandante; antes, o Director de Ensino
  async reabrir(ctx, turmaId, { motivo } = {}) {
    const { t } = await this.#turmaComPlano(turmaId)
    const c = await this.planosCurso.conselho(t.id)
    ctx.actor.exigir(c.estado === 'homologada' ? 'academico.homologar' : 'academico.conselho')
    if (c.estado === 'aberto') return this.estado(ctx, t.id)
    const m = texto(motivo, 'motivo', 'Motivo', { min: 5, max: 500 })
    await this.planosCurso.guardarConselho(t.id, { estado: 'aberto', observacoes: m })
    await this.auditoria.registar(ctx, { acao: 'reabrir_classificacoes', colecao: 'conselho_curso', alvoId: t.id, alvoTitulo: t.nome, detalhes: { motivo: m, de: c.estado } })
    return this.estado(ctx, t.id)
  }
}
