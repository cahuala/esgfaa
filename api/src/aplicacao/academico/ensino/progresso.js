import { Conflito, NaoEncontrado } from '../../../dominio/comum/erros.js'
import { quem } from '../partilhado/autor.js'

// código de verificação legível (sem letras que se confundem: 0/O, 1/I)
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const novoCodigo = () => [...crypto.getRandomValues(new Uint8Array(12))].map((b) => ALFABETO[b % ALFABETO.length]).join('')

// Progresso das atividades, conclusão da cadeira e certificado de conclusão da cadeira.
export class ServicoProgresso {
  constructor(dependencias) {
    Object.assign(this, dependencias)
  }

  async marcarConclusao(ctx, materialId, { concluido = true }) {
    this.acesso.soEstudante(ctx.conta)
    const m = await this.academico.material(materialId)
    if (!m) throw new NaoEncontrado('Material não encontrado.')
    await this.acesso.acessivel(ctx.conta, m.cadeiraId).catch(() => { throw new NaoEncontrado('Material não encontrado.') })
    await this.disponibilidade?.exigir(m.cadeiraId, ctx.conta.id, 'material', m.id)
    await this.recursos.marcarConclusao(m.id, ctx.conta.id, Boolean(concluido))
    if (concluido) await this.registos?.registar(ctx.conta, m.cadeiraId, 'material', m.id)
    return this.progresso(ctx, m.cadeiraId)
  }

  // atividades da cadeira que contam para o progresso: materiais, trabalhos e questionários publicados
  async #atividades(cadeiraId) {
    const [todos, trab, quest, inq, ws, secoes] = await Promise.all([
      this.academico.materiais(cadeiraId),
      this.academico.trabalhos(cadeiraId),
      this.recursos.questionarios(cadeiraId, { soPublicados: true }),
      this.inqueritos ? this.inqueritos.inqueritos(cadeiraId) : [],
      this.workshops ? this.workshops.workshops(cadeiraId) : [],
      this.academico.secoes(cadeiraId),
    ])
    // o que está em capítulos escondidos ainda não conta
    const escondidos = new Set(secoes.filter((x) => !x.visivel).map((x) => x.id))
    const [materiais, trabalhos, questionarios, inqueritos, workshops] = [todos, trab, quest, inq, ws].map((l) => l.filter((a) => !escondidos.has(a.secaoId) && a.visivel !== false))
    return [
      ...materiais.map((m) => ({ tipo: 'material', id: m.id, titulo: m.titulo })),
      ...trabalhos.map((t) => ({ tipo: 'trabalho', id: t.id, titulo: t.titulo })),
      ...questionarios.map((q) => ({ tipo: 'questionario', id: q.id, titulo: q.titulo })),
      ...inqueritos.map((i) => ({ tipo: 'inquerito', id: i.id, titulo: i.titulo })),
      ...workshops.map((w) => ({ tipo: 'workshop', id: w.id, titulo: w.titulo })),
    ]
  }

  async #feitasPor(estudanteId, atividades) {
    const ids = (tipo) => atividades.filter((a) => a.tipo === tipo).map((a) => a.id)
    const [materiais, entregas, tentativas, respondidos, submetidos] = await Promise.all([
      this.recursos.conclusoesDoEstudante(estudanteId, ids('material')),
      this.academico.entregasDoEstudante(estudanteId, ids('trabalho')),
      this.recursos.tentativasDoEstudante(estudanteId, ids('questionario')),
      this.inqueritos ? this.inqueritos.respondidos(estudanteId, ids('inquerito')) : new Set(),
      this.workshops ? this.workshops.estadoDoEstudante(estudanteId, ids('workshop')) : {},
    ])
    const questionarios = new Set(tentativas.filter((t) => t.entregueEm).map((t) => t.questionarioId))
    return atividades.map((a) => ({
      ...a,
      feita: a.tipo === 'material' ? materiais.has(a.id) : a.tipo === 'trabalho' ? Boolean(entregas[a.id]) : a.tipo === 'inquerito' ? respondidos.has(a.id) : a.tipo === 'workshop' ? Boolean(submetidos[a.id]) : questionarios.has(a.id),
    }))
  }

  /*
    Progresso: para o estudante, as suas atividades feitas; para o docente,
    o relatório da turma (estudantes × atividades), como o "Activity completion" do Moodle.
  */
  async progresso(ctx, cadeiraId) {
    const c = await this.acesso.acessivel(ctx.conta, cadeiraId)
    const atividades = await this.#atividades(c.id)
    const resumo = (itens) => {
      const feitas = itens.filter((i) => i.feita).length
      return { feitas, total: itens.length, percentagem: itens.length ? Math.round((feitas / itens.length) * 100) : null }
    }
    if (ctx.conta.tipo === 'estudante') {
      const itens = await this.#feitasPor(ctx.conta.id, atividades)
      return { itens, ...resumo(itens) }
    }
    const estudantes = await this.academico.estudantesAtivosDaTurma(c.turmaId)
    const linhas = await Promise.all(estudantes.map(async (e) => {
      const itens = await this.#feitasPor(e.id, atividades)
      return { estudante: e, concluidas: itens.filter((i) => i.feita).map((i) => `${i.tipo}-${i.id}`), ...resumo(itens) }
    }))
    return { atividades, linhas }
  }

  // a cadeira está concluída quando todas as atividades que contam para o progresso estão feitas
  async conclusao(ctx, cadeiraId) {
    this.acesso.soEstudante(ctx.conta)
    const p = await this.progresso(ctx, cadeiraId)
    const certificado = await this.recursos.certificadoDe(ctx.conta.id, Number(cadeiraId))
    return { feitas: p.feitas, total: p.total, percentagem: p.percentagem, concluida: p.total > 0 && p.feitas === p.total, certificado }
  }

  async emitirCertificado(ctx, cadeiraId) {
    const c = await this.conclusao(ctx, cadeiraId)
    if (c.certificado) return c.certificado
    if (!c.concluida) throw new Conflito(`Ainda faltam atividades: ${c.feitas} de ${c.total} concluídas.`)
    const cadeira = await this.academico.cadeira(cadeiraId)
    const cert = await this.recursos.emitirCertificado({ estudanteId: ctx.conta.id, cadeiraId: cadeira.id, codigo: novoCodigo() })
    await this.auditoria.registar(ctx, { acao: 'emitir_certificado', colecao: 'certificados', alvoId: cadeira.id, alvoTitulo: `${cert.codigo} — ${cadeira.nome}`, utilizador: quem(ctx.conta) })
    return cert
  }

  // verificação pública de um certificado pelo código (sem sessão)
  async verificarCertificado(codigo) {
    const c = await this.recursos.certificado(String(codigo || '').toUpperCase().replace(/[^A-Z0-9]/g, ''))
    if (!c) throw new NaoEncontrado('Certificado não encontrado. Confirme o código.')
    return c
  }

  // percentagem de cada cadeira do estudante (para o painel e a lista de cadeiras)
  async progressoGeral(ctx) {
    this.acesso.soEstudante(ctx.conta)
    const cadeiras = await this.acesso.minhasCadeiras(ctx.conta)
    const pares = await Promise.all(cadeiras.map(async (c) => {
      const itens = await this.#feitasPor(ctx.conta.id, await this.#atividades(c.id))
      const feitas = itens.filter((i) => i.feita).length
      return [c.id, { feitas, total: itens.length, percentagem: itens.length ? Math.round((feitas / itens.length) * 100) : null }]
    }))
    return Object.fromEntries(pares)
  }
}
