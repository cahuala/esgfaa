import { Conflito, ErroValidacao, NaoEncontrado } from '../../dominio/comum/erros.js'
import { texto } from '../../dominio/academico/regras.js'

// baralha (Fisher–Yates) com uma fonte de acaso substituível nos testes
function baralhar(lista, aleatorio) {
  const l = [...lista]
  for (let i = l.length - 1; i > 0; i -= 1) {
    const j = Math.floor(aleatorio() * (i + 1))
    ;[l[i], l[j]] = [l[j], l[i]]
  }
  return l
}

/*
  Distribui os estudantes por grupos: "tamanho" = N estudantes por grupo (o resto espalha-se pelos
  grupos), "numero" = N grupos. Devolve listas de ids.
*/
export function distribuir(ids, modo, valor, aleatorio = Math.random) {
  if (!ids.length) return []
  const n = modo === 'numero' ? Math.min(valor, ids.length) : Math.max(1, Math.floor(ids.length / valor))
  const grupos = Array.from({ length: n }, () => [])
  baralhar(ids, aleatorio).forEach((id, i) => grupos[i % n].push(id))
  return grupos
}

// grupos de estudantes numa cadeira (como os "Groups" do Moodle), geridos pelos docentes
export class ServicoGrupos {
  constructor({ grupos, academico, acesso, aleatorio = Math.random }) {
    Object.assign(this, { grupos, academico, acesso, aleatorio })
  }

  async #estudantes(cadeira) {
    return this.academico.estudantesAtivosDaTurma(cadeira.turmaId)
  }

  // docente: todos os grupos e quem está sem grupo; estudante: o seu grupo
  async listar(ctx, cadeiraId) {
    const c = await this.acesso.acessivel(ctx.conta, cadeiraId)
    if (ctx.conta.tipo === 'estudante') return { meu: await this.grupos.grupoDe(c.id, ctx.conta.id) }
    const [grupos, estudantes] = await Promise.all([this.grupos.grupos(c.id), this.#estudantes(c)])
    const comGrupo = new Set(grupos.flatMap((g) => g.membros.map((m) => m.id)))
    return { grupos, semGrupo: estudantes.filter((e) => !comGrupo.has(e.id)) }
  }

  async #doDocente(ctx, id) {
    const g = await this.grupos.grupo(id)
    if (!g) throw new NaoEncontrado('Grupo não encontrado.')
    const cadeira = await this.acesso.doDocente(ctx.conta, g.cadeiraId)
    return { g, cadeira }
  }

  async #membrosValidos(cadeira, ids) {
    const validos = new Set((await this.#estudantes(cadeira)).map((e) => e.id))
    const lista = [...new Set((ids || []).map(Number))]
    if (lista.some((id) => !validos.has(id))) throw new ErroValidacao('Há estudantes que não pertencem à turma.', { campo: 'membros' })
    return lista
  }

  async criar(ctx, cadeiraId, { nome, membros }) {
    const c = await this.acesso.doDocente(ctx.conta, cadeiraId)
    const g = await this.grupos.criar(c.id, texto(nome, 'nome', 'Nome do grupo', { min: 1, max: 80 }))
    if (membros?.length) await this.grupos.definirMembros(g, await this.#membrosValidos(c, membros))
    return this.grupos.grupo(g.id)
  }

  async atualizar(ctx, id, { nome, membros }) {
    const { g, cadeira } = await this.#doDocente(ctx, id)
    if (nome !== undefined) await this.grupos.renomear(g.id, texto(nome, 'nome', 'Nome do grupo', { min: 1, max: 80 }))
    if (membros !== undefined) await this.grupos.definirMembros(g, await this.#membrosValidos(cadeira, membros))
    return this.grupos.grupo(g.id)
  }

  async apagar(ctx, id) {
    const { g } = await this.#doDocente(ctx, id)
    if (await this.academico.temEntregasDoGrupo(g.id)) throw new Conflito('O grupo já entregou trabalhos: retire os membros em vez de o apagar.')
    await this.grupos.apagar(g.id)
  }

  // cria grupos ao acaso com os estudantes da turma (todos, ou só os que estão sem grupo)
  async automatico(ctx, cadeiraId, { modo, valor, prefixo, soSemGrupo = true }) {
    const c = await this.acesso.doDocente(ctx.conta, cadeiraId)
    const { grupos, semGrupo } = await this.listar(ctx, c.id)
    const ids = (soSemGrupo ? semGrupo : await this.#estudantes(c)).map((e) => e.id)
    if (!ids.length) throw new Conflito('Não há estudantes para distribuir.')
    const base = texto(prefixo || 'Grupo', 'prefixo', 'Nome dos grupos', { min: 1, max: 40 })
    const usados = new Set(grupos.map((g) => g.nome))
    let n = 0
    const proximo = () => { do n += 1; while (usados.has(`${base} ${n}`)); return `${base} ${n}` }
    const lista = distribuir(ids, modo, valor, this.aleatorio).map((estudanteIds) => ({ nome: proximo(), estudanteIds }))
    await this.grupos.criarVarios(c.id, lista)
    return this.listar(ctx, c.id)
  }
}
