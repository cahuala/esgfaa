import { ErroValidacao, NaoEncontrado } from '../../../dominio/comum/erros.js'
import { palavras, noCatalogo } from '../../../dominio/academico/cadeirasCatalogo.js'

/*
  Os docentes de cada cadeira tirados dos horários mensais do arquivo (instalador/conversores/horarios.py): os nomes
  vêm abreviados («Cor-Hamilton», «Brig-Memo», «T.Gen-Horácio Neto»). A Gestão Escolar procura cada um nas fichas
  dos docentes que vieram do Sistema de Pessoal (pelo apelido e, havendo, pelo posto) e propõe-no; a Repartição de
  Administração Escolar confirma (com a fotografia de cada um) e só então o docente fica na cadeira.
  As cadeiras de anos anteriores ficam logo atribuídas (é o registo do que foi); as do ano em curso seguem para o
  Comandante, como a distribuição do serviço docente.
*/
export const CHAVE_DOCENTES_HORARIOS = 'docentes-horarios'
// as palavras do posto e dos títulos (não são o nome)
const POSTOS = new Set(['cor', 'coronel', 'coroneis', 'tcor', 'tcoronel', 'tcoroneis', 'tenente', 'ten', 't', 'gen', 'general', 'tgen', 'tgeneral', 'brig', 'brigadeiro', 'maj', 'major', 'cap', 'capitao', 'frag', 'fragata', 'corveta', 'mar', 'guerra', 'alm', 'almirante', 'calm', 'valm', 'vice', 'contra', 'dr', 'dra', 'doutor', 'doutora', 'mestre', 'mesc', 'msc', 'eng', 'ref', 'refa', 'reformado', 'sub', 'comissario', 'superintendente', 'super', 'chefe', 'ass', 'pt', 'port', 'portuguesa', 'professor', 'prof'])
// o posto abreviado do horário → o começo do posto da ficha
const POSTO_DO_HORARIO = [[/t\.?\s*gen/i, 'tenente-general'], [/brig/i, 'brigadeiro'], [/t\.?\s*cor/i, 'tenente-coronel'], [/\bcor/i, 'coronel'], [/maj/i, 'major'], [/cap/i, 'capit'], [/gen/i, 'general'], [/c\/?\s*alm/i, 'contra-almirante']]
const sem = (v) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const igual = (a, b) => (a.length >= 6 && b.length >= 6 ? a.slice(0, 6) === b.slice(0, 6) : a === b || (a.length >= 4 && b.startsWith(a)) || (b.length >= 4 && a.startsWith(b)))
const sigla = (v) => sem(v).replace(/[^a-z0-9]/g, '')

// o nome sem o posto nem os títulos: as palavras que têm de estar no nome da ficha
export function apelidos(texto) {
  return palavras(String(texto ?? '').replace(/\(.*?\)/g, ' ')).filter((w) => w.length >= 3 && !POSTOS.has(w))
}

export class ServicoDocentesHorarios {
  constructor({ prisma, paginas, auditoria, aprovacaoComandante = false }) {
    Object.assign(this, { prisma, paginas, auditoria, aprovacaoComandante })
  }

  // a carga inicial guarda a folha dos horários (vem no pendrive, em CARREGAR)
  async guardar(ctx, { linhas = [] } = {}) {
    if (!Array.isArray(linhas)) throw new ErroValidacao('Faltam as linhas dos horários.')
    const limpas = linhas.slice(0, 2000).map((l) => ({
      anoLetivo: String(l.anoLetivo ?? '').slice(0, 9), curso: String(l.curso ?? '').slice(0, 200), sigla: String(l.sigla ?? '').slice(0, 20),
      cadeira: String(l.cadeira ?? '').slice(0, 200), texto: String(l.texto ?? '').slice(0, 400), nomes: (Array.isArray(l.nomes) ? l.nomes : []).map((n) => String(n).slice(0, 120)).slice(0, 20),
    }))
    await this.paginas.guardar(CHAVE_DOCENTES_HORARIOS, { linhas: limpas, guardadoEm: new Date().toISOString() }, ctx.actor?.id ?? null)
    return { linhas: limpas.length }
  }

  // a turma do horário: o mesmo ano lectivo e o curso (pela edição e pelas palavras do nome)
  #turmaDe(l, turmas) {
    const edicao = /(\d{1,3})\s*\.?\s*º/.exec(l.curso)?.[1]
    const p = palavras(l.curso).filter((w) => w !== 'curso')
    let melhor = null
    for (const t of turmas.filter((x) => x.anoLetivo === l.anoLetivo)) {
      if (edicao && !new RegExp(`^\\s*${edicao}\\s*\\.?\\s*º`).test(t.nome)) continue
      const n = palavras(t.nome)
      const pontos = p.filter((w) => n.some((x) => igual(w, x))).length
      if (pontos >= 2 && (!melhor || pontos > melhor.pontos)) melhor = { t, pontos }
    }
    return melhor?.t ?? null
  }

  #cadeiraDe(l, turma) {
    const s = sigla(l.sigla)
    return turma.cadeiras.find((c) => sigla(c.codigo) === s) ?? noCatalogo(l.cadeira, turma.cadeiras.map((c) => ({ nome: c.nome, c })))?.c ?? null
  }

  // os docentes da ficha que correspondem a um nome do horário (os apelidos e, se houver, o posto)
  #candidatos(nome, docentes) {
    const ap = apelidos(nome)
    if (!ap.length) return []
    const posto = POSTO_DO_HORARIO.find(([re]) => re.test(nome))?.[1]
    const achados = docentes.filter((d) => { const n = palavras(d.nome); return ap.every((w) => n.some((x) => igual(w, x))) })
    if (posto && achados.length > 1) {
      const comPosto = achados.filter((d) => sem(d.dados?.posto).startsWith(posto))
      if (comPosto.length) return comPosto
    }
    return achados
  }

  async sugestoes(ctx) {
    ctx.actor.exigir('academico.ver')
    const guardado = (await this.paginas.ler(CHAVE_DOCENTES_HORARIOS)) ?? { linhas: [] }
    if (!guardado.linhas?.length) return { cadeiras: [], linhas: 0 }
    const anos = [...new Set(guardado.linhas.map((l) => l.anoLetivo))]
    const turmas = await this.prisma.turma.findMany({ where: { anoLetivo: { in: anos } }, include: { cadeiras: { include: { docentes: { include: { docente: { select: { id: true, nome: true } } } } } } } })
    const docentes = (await this.prisma.contaPortal.findMany({ where: { tipo: 'docente' }, select: { id: true, nome: true, dados: true, fotoCaminho: true, ativo: true } }))
    const porCadeira = new Map()
    let semTurma = 0
    for (const l of guardado.linhas) {
      const t = this.#turmaDe(l, turmas)
      const c = t && this.#cadeiraDe(l, t)
      if (!c) { semTurma++; continue }
      const x = porCadeira.get(c.id) ?? { cadeiraId: c.id, codigo: c.codigo, nome: c.nome, turma: t.nome, turmaId: t.id, anoLetivo: t.anoLetivo, atuais: c.docentes.map((d) => ({ id: d.docente.id, nome: d.docente.nome, estado: d.estado })), nomes: new Set(), texto: new Set() }
      for (const n of l.nomes) x.nomes.add(n)
      if (l.texto) x.texto.add(l.texto)
      porCadeira.set(c.id, x)
    }
    const resumo = (d) => ({ id: d.id, nome: d.nome, posto: d.dados?.posto ?? '', nip: d.dados?.nip ?? '', temFoto: Boolean(d.fotoCaminho), ativo: d.ativo })
    const cadeiras = [...porCadeira.values()].map((x) => {
      const ja = new Set(x.atuais.map((d) => d.id))
      const sugestoes = [...x.nomes].map((n) => {
        const cs = this.#candidatos(n, docentes)
        return { texto: n, candidatos: cs.map(resumo), sugerido: cs.length === 1 ? cs[0].id : null, jaNaCadeira: cs.length === 1 && ja.has(cs[0].id) }
      })
      return { ...x, nomes: undefined, texto: [...x.texto], sugestoes }
    }).sort((a, b) => b.anoLetivo.localeCompare(a.anoLetivo) || a.turma.localeCompare(b.turma) || a.nome.localeCompare(b.nome))
    return { cadeiras, linhas: guardado.linhas.length, semTurma, guardadoEm: guardado.guardadoEm ?? null }
  }

  /*
    Os anos anteriores sem dúvida: quando o nome do horário só pode ser um docente, ele fica logo na cadeira (é o
    registo do que foi). Os de várias pessoas possíveis e os do ano em curso esperam pela Repartição.
  */
  async confirmarSemDuvida(ctx) {
    const s = await this.sugestoes(ctx)
    if (!s.cadeiras.length) return { feitas: 0 }
    const ativas = new Set((await this.prisma.turma.findMany({ where: { ativa: true }, select: { id: true } })).map((t) => t.id))
    const escolhas = []
    for (const c of s.cadeiras) {
      if (ativas.has(c.turmaId)) continue
      for (const x of c.sugestoes) if (x.sugerido && !x.jaNaCadeira && !c.atuais.some((d) => d.id === x.sugerido)) escolhas.push({ cadeiraId: c.cadeiraId, docenteId: x.sugerido })
    }
    if (!escolhas.length) return { feitas: 0 }
    const r = await this.confirmar(ctx, escolhas)
    return { feitas: r.feitas }
  }

  // a Repartição confirma: cada docente escolhido fica na cadeira (regente se for o primeiro, senão assistente)
  async confirmar(ctx, escolhas = []) {
    ctx.actor.exigir('academico.gerir')
    if (!Array.isArray(escolhas) || !escolhas.length) throw new ErroValidacao('Escolha pelo menos um docente.')
    let feitas = 0
    for (const e of escolhas.slice(0, 1000)) {
      const c = await this.prisma.unidadeCurricular.findUnique({ where: { id: Number(e.cadeiraId) }, include: { turma: true, docentes: true } })
      const d = await this.prisma.contaPortal.findUnique({ where: { id: Number(e.docenteId) } })
      if (!c || !d || d.tipo !== 'docente') throw new NaoEncontrado('Cadeira ou docente não encontrado.')
      if (c.docentes.some((x) => x.docenteId === d.id)) continue
      // as cadeiras de anos anteriores ficam registadas tal como foram; as do ano em curso seguem para o Comandante
      const estado = c.turma.ativa && this.aprovacaoComandante ? 'proposta' : 'aprovada'
      await this.prisma.docencia.create({ data: { cadeiraId: c.id, docenteId: d.id, papel: c.docentes.length ? 'assistente' : 'regente', estado } })
      feitas++
    }
    if (feitas) await this.auditoria.registar(ctx, { acao: 'docentes_dos_horarios', colecao: 'cadeiras', alvoTitulo: `${feitas} docente(s) nas cadeiras (dos horários do arquivo)` })
    return { feitas, ...(await this.sugestoes(ctx)) }
  }
}
