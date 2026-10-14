import { NaoEncontrado } from '../../../dominio/comum/erros.js'
import { intervaloCalendario, TIPOS_EVENTO_CADEIRA, validarEvento } from '../../../dominio/academico/organizacao/calendario.js'
import { expandirAulas } from '../../../dominio/academico/organizacao/horario.js'
import { gerarIcal } from '../../../dominio/academico/organizacao/ical.js'
import { quem } from '../partilhado/autor.js'

// Calendário académico de cada conta (e a assinatura iCal) e datas marcadas pelo docente.
export class ServicoCalendario {
  constructor(dependencias) {
    Object.assign(this, dependencias)
  }

  /*
    Calendário de quem pede, entre duas datas: eventos (provas, exames, eventos gerais e da turma),
    aulas do horário (sem os feriados), prazos dos trabalhos e fecho dos questionários.
  */
  async calendario(ctx, { de, ate }) {
    const intervalo = intervaloCalendario(de, ate)
    const cadeiras = await this.acesso.minhasCadeiras(ctx.conta)
    const ids = cadeiras.map((c) => c.id)
    const turmaIds = [...new Set(cadeiras.map((c) => c.turmaId))]
    const [eventos, horarios, todosTrabalhos, todosQuestionarios, todosMateriais, todosWorkshops] = await Promise.all([
      this.recursos.eventos({ cadeiraIds: ids, turmaIds, ...intervalo }),
      this.academico.horariosDasCadeiras(ids),
      Promise.all(ids.map((id) => this.academico.trabalhos(id))).then((l) => l.flat()),
      Promise.all(ids.map((id) => this.recursos.questionarios(id, { soPublicados: ctx.conta.tipo === 'estudante' }))).then((l) => l.flat()),
      Promise.all(ids.map((id) => this.academico.materiais(id))).then((l) => l.flat().filter((m) => m.tipo === 'videoconferencia')),
      this.workshops ? Promise.all(ids.map((id) => this.workshops.workshops(id))).then((l) => l.flat()) : [],
    ])
    // o estudante não vê no calendário o que está escondido
    let visivel
    if (ctx.conta.tipo === 'estudante' && this.disponibilidade) {
      const acessos = Object.assign({}, ...(await Promise.all(ids.map((id) => this.disponibilidade.acessos(id, ctx.conta.id)))).map((a) => a.acessos))
      visivel = (tipo) => (a) => acessos[`${tipo}-${a.id}`] && !acessos[`${tipo}-${a.id}`].escondida
    } else visivel = () => () => true
    const trabalhos = todosTrabalhos.filter(visivel('trabalho'))
    const questionarios = todosQuestionarios.filter(visivel('questionario'))
    const sessoes = todosMateriais.filter(visivel('material'))
    const workshops = todosWorkshops.filter(visivel('workshop'))
    const nomeDe = Object.fromEntries(cadeiras.map((c) => [c.id, c.nome]))
    const feriados = eventos.filter((e) => e.tipo === 'feriado').map((e) => e.data)
    const dia = (iso) => (iso ? new Date(iso).toISOString().slice(0, 10) : null)
    const dentro = (d) => d && d >= intervalo.de && d <= intervalo.ate
    const hora = (iso) => new Date(iso).toISOString().slice(11, 16)
    return [
      ...eventos.map((e) => ({
        tipo: e.tipo, id: `e${e.id}`, eventoId: e.id, data: e.data, inicio: e.inicio, fim: e.fim, titulo: e.titulo, local: e.local, descricao: e.descricao,
        cadeiraId: e.cadeiraId, cadeira: e.cadeira?.nome || null, turma: e.turma?.nome || null,
      })),
      ...expandirAulas(horarios, intervalo.de, intervalo.ate, feriados).map((a) => ({
        tipo: 'aula', id: `a${a.id}-${a.data}`, data: a.data, inicio: a.inicio, fim: a.fim, titulo: a.cadeira, local: a.sala, cadeiraId: a.cadeiraId, cadeira: a.cadeira,
      })),
      ...trabalhos.filter((t) => dentro(dia(t.prazo))).map((t) => ({
        tipo: 'prazo', id: `t${t.id}`, data: dia(t.prazo), inicio: hora(t.prazo), fim: '', momento: t.prazo, titulo: `Entrega: ${t.titulo}`, cadeiraId: t.cadeiraId, cadeira: nomeDe[t.cadeiraId],
      })),
      ...questionarios.filter((q) => dentro(dia(q.fecha))).map((q) => ({
        tipo: 'questionario', id: `q${q.id}`, data: dia(q.fecha), inicio: hora(q.fecha), fim: '', momento: q.fecha, titulo: `Questionário: ${q.titulo}`, cadeiraId: q.cadeiraId, cadeira: nomeDe[q.cadeiraId],
      })),
      ...sessoes.filter((m) => dentro(dia(m.inicio))).map((m) => ({
        tipo: 'sessao', id: `v${m.id}`, data: dia(m.inicio), inicio: hora(m.inicio), fim: '', momento: m.inicio, duracao: m.duracao, titulo: `Videoconferência: ${m.titulo}`,
        cadeiraId: m.cadeiraId, cadeira: nomeDe[m.cadeiraId], local: 'Online', descricao: m.url,
      })),
      ...workshops.flatMap((w) => [['fimSubmissao', 'Entrega (avaliação por pares)'], ['fimAvaliacao', 'Avaliar colegas']]
        .filter(([k]) => dentro(dia(w[k])))
        .map(([k, nome]) => ({ tipo: 'prazo', id: `w${w.id}-${k}`, data: dia(w[k]), inicio: hora(w[k]), fim: '', momento: w[k], titulo: `${nome}: ${w.titulo}`, cadeiraId: w.cadeiraId, cadeira: nomeDe[w.cadeiraId] }))),
    ].sort((a, b) => a.data.localeCompare(b.data) || (a.inicio || '').localeCompare(b.inicio || ''))
  }

  // endereço secreto da assinatura (cria-o na primeira vez; renovar invalida o antigo)
  async tokenCalendario(ctx, { renovar = false } = {}) {
    let token = await this.contas.tokenCalendario(ctx.conta.id)
    if (!token || renovar) {
      token = [...crypto.getRandomValues(new Uint8Array(24))].map((b) => b.toString(16).padStart(2, '0')).join('')
      await this.contas.definirTokenCalendario(ctx.conta.id, token)
    }
    return { token }
  }

  // o calendário de 30 dias para trás a 6 meses para a frente, para quem tem o endereço secreto
  async ical(token) {
    const conta = /^[0-9a-f]{48}$/.test(String(token)) ? await this.contas.porTokenCalendario(token) : null
    if (!conta || !conta.ativo) throw new NaoEncontrado('Calendário não encontrado.')
    const ctx = { conta }
    const agora = this.relogio.agora()
    const itens = []
    for (let d = -30; d < 180; d += 45) {
      const de = new Date(agora.getTime() + d * 86_400_000).toISOString().slice(0, 10)
      const ate = new Date(agora.getTime() + (d + 44) * 86_400_000).toISOString().slice(0, 10)
      itens.push(...await this.calendario(ctx, { de, ate }))
    }
    const unicos = [...new Map(itens.map((i) => [i.id, i])).values()]
    return gerarIcal(unicos, { nome: `ESG — ${conta.nome}`, agora })
  }

  async eventosDaCadeira(ctx, cadeiraId) {
    const c = await this.acesso.acessivel(ctx.conta, cadeiraId)
    return this.recursos.eventosDaCadeira(c.id)
  }

  // o docente marca as provas, o exame e o recurso da sua cadeira
  async criarEvento(ctx, cadeiraId, dados) {
    const c = await this.acesso.doDocente(ctx.conta, cadeiraId)
    const e = await this.recursos.criarEvento({ cadeiraId: c.id, ...validarEvento(dados, TIPOS_EVENTO_CADEIRA) })
    await this.auditoria.registar(ctx, { acao: 'marcar_evento', colecao: 'calendario', alvoId: e.id, alvoTitulo: `${e.titulo} — ${c.nome} (${e.data})`, utilizador: quem(ctx.conta) })
    await this.apoio.avisarEstudantes(ctx, c, null, {
      tipo: 'geral', titulo: `${e.titulo} de ${c.nome} marcada`, texto: `${e.data.split('-').reverse().join('/')}${e.inicio ? `, ${e.inicio}` : ''}${e.local ? ` · ${e.local}` : ''}`,
      ligacao: `/cadeiras/${c.id}?separador=horario`,
    })
    return e
  }

  async apagarEvento(ctx, id) {
    const e = await this.recursos.evento(id)
    if (!e || !e.cadeiraId) throw new NaoEncontrado('Evento não encontrado.')
    await this.acesso.doDocente(ctx.conta, e.cadeiraId)
    await this.recursos.apagarEvento(e.id)
  }
}
