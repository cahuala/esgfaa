import { ErroValidacao, NaoEncontrado } from '../../../dominio/comum/erros.js'

/*
  Horário mensal da turma (Administração Escolar), como os da Repartição: as colunas são os dias úteis do mês e as
  linhas os tempos do dia; em cada célula a cadeira (pela sigla/código) — a sessão S1, S2… conta-se sozinha, pela
  ordem das datas em todo o ano — ou um texto (Feriado, Ponte, HNC, TAG, Trabalho de campo…). No fim, a legenda das
  cadeiras e dos docentes. Imprime-se e exporta-se para o Excel.
*/
// os tempos de aula da ESG (como nos horários mensais do arquivo)
export const BLOCOS_HORARIO = ['08:30-09:20', '09:30-10:20', '10:30-11:20', '11:40-12:20', '12:40-13:30', '14:30-15:30', '15:40-16:20']
const MES = /^\d{4}-(0[1-9]|1[0-2])$/
const DATA = /^\d{4}-\d{2}-\d{2}$/

export class ServicoHorarioMensal {
  constructor({ prisma, academico, auditoria }) {
    Object.assign(this, { prisma, academico, auditoria })
  }

  async #turma(id) {
    const t = await this.academico.turma(id)
    if (!t) throw new NaoEncontrado('Turma não encontrada.')
    return t
  }

  // o mês: os dias úteis (segunda a sexta), as células, as cadeiras da turma e a sessão de cada célula
  async doMes(ctx, turmaId, mes) {
    ctx.actor.exigir('academico.ver')
    if (!MES.test(String(mes))) throw new ErroValidacao('Mês inválido (AAAA-MM).', { campo: 'mes' })
    const t = await this.#turma(turmaId)
    const [a, m] = mes.split('-').map(Number)
    const dias = []
    for (let d = 1; d <= new Date(Date.UTC(a, m, 0)).getUTCDate(); d++) {
      const x = new Date(Date.UTC(a, m - 1, d))
      if (x.getUTCDay() >= 1 && x.getUTCDay() <= 5) dias.push({ data: x.toISOString().slice(0, 10), diaSemana: x.getUTCDay() })
    }
    const cadeiras = await this.academico.cadeirasDasTurmas([t.id])
    // todas as células da turma (para numerar as sessões de cada cadeira pela ordem das datas e dos tempos)
    const todas = await this.prisma.horarioDia.findMany({ where: { turmaId: t.id }, orderBy: [{ data: 'asc' }, { bloco: 'asc' }] })
    const contagem = new Map()
    const sessao = new Map()
    for (const c of todas) {
      if (!c.cadeiraId) continue
      const n = (contagem.get(c.cadeiraId) ?? 0) + 1
      contagem.set(c.cadeiraId, n)
      sessao.set(c.id, n)
    }
    const doMes = todas.filter((c) => c.data.toISOString().slice(0, 7) === mes)
    return {
      turma: { id: t.id, nome: t.nome, curso: t.curso, anoLetivo: t.anoLetivo }, mes, blocos: BLOCOS_HORARIO, dias,
      celulas: doMes.map((c) => ({ data: c.data.toISOString().slice(0, 10), bloco: c.bloco, cadeiraId: c.cadeiraId, texto: c.texto, sessao: sessao.get(c.id) ?? null })),
      cadeiras: cadeiras.map((c) => ({ id: c.id, codigo: c.codigo, nome: c.nome, docentes: c.docentes.map((d) => d.nome), sessoes: contagem.get(c.id) ?? 0 })),
    }
  }

  // muda uma célula: a cadeira, um texto, ou nada (apaga)
  async guardar(ctx, turmaId, { data, bloco, cadeiraId = null, texto = '' }) {
    ctx.actor.exigir('academico.gerir')
    const t = await this.#turma(turmaId)
    if (!DATA.test(String(data))) throw new ErroValidacao('Data inválida.', { campo: 'data' })
    if (!BLOCOS_HORARIO.includes(bloco)) throw new ErroValidacao('Tempo inválido.', { campo: 'bloco' })
    const txt = String(texto ?? '').trim().slice(0, 40)
    if (cadeiraId) {
      const c = await this.academico.cadeira(cadeiraId)
      if (!c || c.turmaId !== t.id) throw new ErroValidacao('Essa cadeira não é desta turma.', { campo: 'cadeiraId' })
    }
    const chave = { turmaId_data_bloco: { turmaId: t.id, data: new Date(`${data}T00:00:00Z`), bloco } }
    if (!cadeiraId && !txt) await this.prisma.horarioDia.deleteMany({ where: chave.turmaId_data_bloco })
    else await this.prisma.horarioDia.upsert({ where: chave, create: { ...chave.turmaId_data_bloco, cadeiraId: cadeiraId || null, texto: txt }, update: { cadeiraId: cadeiraId || null, texto: txt } })
    await this.auditoria.registar(ctx, { acao: 'horario_mensal', colecao: 'turmas', alvoId: t.id, alvoTitulo: t.nome, detalhes: { data, bloco, cadeiraId, texto: txt } })
    return this.doMes(ctx, t.id, data.slice(0, 7))
  }
}
