import { ErroValidacao, NaoEncontrado } from '../../dominio/comum/erros.js'
import { chave } from '../../dominio/academico/disponibilidade.js'

export const TIPOS_REGISTO = ['cadeira', 'material', 'trabalho', 'questionario', 'inquerito', 'forum']
const INTERVALO = 5 * 60_000 // a mesma página aberta outra vez dentro de 5 minutos não conta de novo

/*
  Registo de acessos dos estudantes ("logs" do Moodle) e relatórios de participação para o docente.
  Registar nunca faz falhar o pedido de quem está a usar o portal.
*/
export class ServicoRegistos {
  constructor({ registos, academico, acesso, disponibilidade, relogio, registarErro = () => {} }) {
    Object.assign(this, { registos, academico, acesso, disponibilidade, relogio, registarErro })
    this.recentes = new Map()
  }

  registar(conta, cadeiraId, tipo, alvoId = null) {
    if (conta?.tipo !== 'estudante' || !TIPOS_REGISTO.includes(tipo)) return
    const agora = this.relogio.agora().getTime()
    const k = `${conta.id}:${cadeiraId}:${tipo}:${alvoId}`
    if (agora - (this.recentes.get(k) ?? -Infinity) < INTERVALO) return
    if (this.recentes.size > 10_000) this.recentes.clear()
    this.recentes.set(k, agora)
    return this.registos.registar({ cadeiraId: Number(cadeiraId), contaId: conta.id, tipo, alvoId: alvoId === null ? null : Number(alvoId), em: new Date(agora) })
      .catch((e) => this.registarErro({ registo: 'acesso', erro: e.message }))
  }

  // o portal diz que o estudante abriu uma atividade (página, pasta, trabalho…)
  async vista(ctx, cadeiraId, { tipo, id }) {
    if (ctx.conta.tipo !== 'estudante') return { registado: false }
    if (!['material', 'trabalho', 'inquerito', 'questionario'].includes(tipo)) throw new ErroValidacao('Tipo de atividade inválido.', { campo: 'tipo' })
    const c = await this.acesso.acessivel(ctx.conta, cadeiraId)
    const { acessos } = await this.disponibilidade.acessos(c.id, ctx.conta.id)
    const a = acessos[chave(tipo, id)]
    if (!a || a.escondida) throw new NaoEncontrado('Atividade não encontrada.')
    await this.registar(ctx.conta, c.id, tipo, id)
    return { registado: true }
  }

  async #titulos(cadeiraId) {
    const { lista } = await this.disponibilidade.atividades(cadeiraId)
    return Object.fromEntries(lista.map((a) => [a.chave, a.titulo]))
  }

  // docente: uma linha por estudante e uma por atividade
  async participacao(ctx, cadeiraId) {
    const c = await this.acesso.doDocente(ctx.conta, cadeiraId)
    const [estudantes, p, porAtividade, { lista }] = await Promise.all([
      this.academico.estudantesAtivosDaTurma(c.turmaId), this.registos.participacao(c.id), this.registos.porAtividade(c.id), this.disponibilidade.atividades(c.id),
    ])
    const entregas = await Promise.all(estudantes.map((e) => this.academico.entregasDoEstudante(e.id, lista.filter((a) => a.tipoAtividade === 'trabalho').map((a) => a.id))))
    const agora = this.relogio.agora()
    return {
      estudantes: estudantes.map((e, i) => {
        const a = p.acessos[e.id]
        return {
          estudante: e, acessos: a?.acessos ?? 0, ultimoAcesso: a?.ultimo ?? null,
          diasSemAcesso: a?.ultimo ? Math.floor((agora - new Date(a.ultimo)) / 86_400_000) : null,
          atividadesVistas: p.vistas[e.id] ?? 0, entregas: Object.keys(entregas[i]).length,
          questionarios: p.tentativas[e.id] ?? 0, forum: p.forum[e.id] ?? 0,
        }
      }),
      atividades: lista.map((x) => ({ tipo: x.tipoAtividade, id: x.id, titulo: x.titulo, ...(porAtividade[x.chave] || { vistas: 0, estudantes: 0 }) })),
      totalEstudantes: estudantes.length,
    }
  }

  // docente: registos recentes (todos, ou de um estudante), 100 de cada vez
  async lista(ctx, cadeiraId, { estudanteId, antesDe }) {
    const c = await this.acesso.doDocente(ctx.conta, cadeiraId)
    const [linhas, titulos] = await Promise.all([
      this.registos.registos(c.id, { contaId: estudanteId ? Number(estudanteId) : null, antesDe: antesDe ? Number(antesDe) : null }),
      this.#titulos(c.id),
    ])
    return linhas.map((l) => ({ ...l, titulo: l.tipo === 'cadeira' ? 'Página da cadeira' : l.tipo === 'forum' ? 'Fórum' : titulos[chave(l.tipo, l.alvoId)] || '(atividade apagada)' }))
  }
}
