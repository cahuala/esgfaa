import { invalido, naoEncontrado, semPermissao } from '../erros.js'
import { abreviaturaDoPosto } from '../dominio/pessoal/hierarquia.js'
import { exigir } from './sessao.js'

/*
  Mensagens internas: a conversa geral da Escola (todos), a de cada unidade (quem lá está), conversas
  directas entre duas pessoas e grupos. O navegador pergunta de poucos em poucos segundos se há novas.
*/
export class ServicoMensagens {
  constructor({ bd, ficheiros, agora = () => new Date() }) {
    Object.assign(this, { bd, ficheiros, agora })
  }

  // garante que existem a conversa geral e a da unidade do utilizador, e que ele participa nelas
  async #base(u) {
    let geral = await this.bd.conversa.findFirst({ where: { tipo: 'geral' } })
    if (!geral) geral = await this.bd.conversa.create({ data: { tipo: 'geral', nome: 'Escola Superior de Guerra (todos)' } }).catch(() => this.bd.conversa.findFirst({ where: { tipo: 'geral' } }))
    const ids = [geral.id]
    if (u.unidadeId) {
      const un = await this.bd.unidade.findUnique({ where: { id: u.unidadeId }, select: { nome: true } })
      const c = await this.bd.conversa.upsert({ where: { unidadeId: u.unidadeId }, create: { tipo: 'unidade', unidadeId: u.unidadeId, nome: un?.nome ?? 'Unidade' }, update: {} })
      ids.push(c.id)
    }
    for (const id of ids) await this.bd.participante.upsert({ where: { conversaId_utilizadorId: { conversaId: id, utilizadorId: u.id } }, create: { conversaId: id, utilizadorId: u.id, lidoAte: new Date(0) }, update: {} })
  }

  async #acesso(u, conversaId) {
    const c = await this.bd.conversa.findUnique({ where: { id: conversaId } })
    if (!c) throw naoEncontrado('Conversa não encontrada.')
    if (c.tipo === 'unidade' && c.unidadeId !== u.unidadeId) throw semPermissao('Esta conversa é de outra unidade.')
    if (c.tipo === 'geral' || c.tipo === 'unidade') {
      await this.bd.participante.upsert({ where: { conversaId_utilizadorId: { conversaId, utilizadorId: u.id } }, create: { conversaId, utilizadorId: u.id, lidoAte: new Date(0) }, update: {} })
      return c
    }
    if (!(await this.bd.participante.count({ where: { conversaId, utilizadorId: u.id } }))) throw semPermissao('Não participa nesta conversa.')
    return c
  }

  async conversas(u) {
    exigir(u, 'mensagens')
    await this.#base(u)
    const ps = await this.bd.participante.findMany({
      where: { utilizadorId: u.id, conversa: { OR: [{ tipo: { in: ['geral', 'directa', 'grupo'] } }, { tipo: 'unidade', unidadeId: u.unidadeId ?? -1 }] } },
      include: { conversa: { include: { participantes: { include: { utilizador: { select: { id: true, nome: true, pessoa: { select: { posto: true, ramo: true, fotoId: true, id: true } } } } } }, mensagens: { orderBy: { id: 'desc' }, take: 1, include: { autor: { select: { nome: true } } } } } } },
    })
    const r = []
    for (const p of ps) {
      const c = p.conversa
      const outro = c.tipo === 'directa' ? c.participantes.find((x) => x.utilizadorId !== u.id)?.utilizador : null
      const naoLidas = await this.bd.mensagem.count({ where: { conversaId: c.id, criadoEm: { gt: p.lidoAte }, autorId: { not: u.id } } })
      const ultima = c.mensagens[0]
      r.push({
        id: c.id, tipo: c.tipo, nome: outro ? this.#nome(outro) : c.nome, pessoaId: outro?.pessoa?.id ?? null, fotoId: outro?.pessoa?.fotoId ?? null,
        membros: c.tipo === 'grupo' ? c.participantes.length : undefined, naoLidas, ultimaEm: c.ultimaEm,
        ultima: ultima ? { texto: ultima.texto.slice(0, 120) || (ultima.nomeOriginal ? `📎 ${ultima.nomeOriginal}` : ''), autor: ultima.autor.nome, minha: ultima.autorId === u.id } : null,
      })
    }
    const ordem = { geral: 0, unidade: 1 }
    return r.sort((a, b) => (ordem[a.tipo] ?? 2) - (ordem[b.tipo] ?? 2) || new Date(b.ultimaEm) - new Date(a.ultimaEm))
  }

  #nome(x) {
    return `${x.pessoa?.posto ? `${abreviaturaDoPosto(x.pessoa.posto, x.pessoa.ramo)} ` : ''}${x.nome}`
  }

  async naoLidas(u) {
    const ps = await this.bd.participante.findMany({ where: { utilizadorId: u.id, conversa: { OR: [{ tipo: { not: 'unidade' } }, { unidadeId: u.unidadeId ?? -1 }] } }, select: { conversaId: true, lidoAte: true } })
    let n = 0
    for (const p of ps) n += await this.bd.mensagem.count({ where: { conversaId: p.conversaId, criadoEm: { gt: p.lidoAte }, autorId: { not: u.id } } })
    return n
  }

  // com quem se pode falar: todas as contas activas
  async contactos(u) {
    exigir(u, 'mensagens')
    const l = await this.bd.utilizador.findMany({ where: { ativo: true, id: { not: u.id } }, select: { id: true, nome: true, unidade: { select: { nome: true } }, pessoa: { select: { id: true, posto: true, ramo: true, fotoId: true } } }, orderBy: { nome: 'asc' } })
    return l.map((x) => ({ id: x.id, nome: this.#nome(x), unidadeNome: x.unidade?.nome ?? '', pessoaId: x.pessoa?.id ?? null, fotoId: x.pessoa?.fotoId ?? null }))
  }

  async directa(u, outroId) {
    exigir(u, 'mensagens')
    if (outroId === u.id) throw invalido('Escolha outra pessoa.')
    const outro = await this.bd.utilizador.findUnique({ where: { id: outroId } })
    if (!outro?.ativo) throw naoEncontrado('Essa pessoa não tem conta activa.')
    const chave = [u.id, outroId].sort((a, b) => a - b).join('-')
    const c = await this.bd.conversa.upsert({ where: { chave }, create: { tipo: 'directa', chave, participantes: { create: [{ utilizadorId: u.id, lidoAte: new Date(0) }, { utilizadorId: outroId, lidoAte: new Date(0) }] } }, update: {} })
    return { id: c.id }
  }

  async grupo(u, { nome, membros = [] }) {
    exigir(u, 'mensagens')
    const ids = [...new Set([u.id, ...membros.map(Number)])]
    if (ids.length < 3) throw invalido('Um grupo tem pelo menos 3 pessoas (para duas, use uma conversa directa).')
    const c = await this.bd.conversa.create({ data: { tipo: 'grupo', nome, participantes: { create: ids.map((id) => ({ utilizadorId: id, lidoAte: new Date(0) })) } } })
    return { id: c.id }
  }

  // mensagens da conversa (depois = só as mais recentes que esse id); marca como lidas
  async mensagens(u, conversaId, { depois = 0 } = {}) {
    exigir(u, 'mensagens')
    const c = await this.#acesso(u, conversaId)
    const l = await this.bd.mensagem.findMany({
      where: { conversaId, ...(depois ? { id: { gt: depois } } : {}) }, orderBy: { id: depois ? 'asc' : 'desc' }, take: depois ? 500 : 200,
      include: { autor: { select: { id: true, nome: true, pessoa: { select: { id: true, posto: true, ramo: true, fotoId: true } } } } },
    })
    if (!depois) l.reverse()
    await this.bd.participante.update({ where: { conversaId_utilizadorId: { conversaId, utilizadorId: u.id } }, data: { lidoAte: this.agora() } })
    return {
      conversa: { id: c.id, tipo: c.tipo, nome: c.nome },
      mensagens: l.map((m) => ({ id: m.id, texto: m.texto, criadoEm: m.criadoEm, autorId: m.autorId, autor: this.#nome(m.autor), pessoaId: m.autor.pessoa?.id ?? null, fotoId: m.autor.pessoa?.fotoId ?? null, minha: m.autorId === u.id, anexo: m.ficheiro ? { nome: m.nomeOriginal } : null })),
    }
  }

  async enviar(u, conversaId, { texto = '' }, ficheiro) {
    exigir(u, 'mensagens')
    await this.#acesso(u, conversaId)
    const t = String(texto).trim().slice(0, 4000)
    if (!t && !ficheiro) throw invalido('Escreva a mensagem.')
    const f = ficheiro ? await this.ficheiros.guardar(ficheiro) : null
    // a mesma hora para a mensagem e para o «lido até» (senão a própria mensagem podia ficar por ler)
    const m = await this.bd.mensagem.create({ data: { conversaId, autorId: u.id, texto: t, ficheiro: f?.ficheiro ?? null, nomeOriginal: f?.nomeOriginal ?? null, criadoEm: this.agora() } })
    await this.bd.conversa.update({ where: { id: conversaId }, data: { ultimaEm: m.criadoEm } })
    await this.bd.participante.update({ where: { conversaId_utilizadorId: { conversaId, utilizadorId: u.id } }, data: { lidoAte: m.criadoEm } })
    return { id: m.id }
  }

  async anexo(u, mensagemId) {
    exigir(u, 'mensagens')
    const m = await this.bd.mensagem.findUnique({ where: { id: mensagemId } })
    if (!m?.ficheiro) throw naoEncontrado('Anexo não encontrado.')
    await this.#acesso(u, m.conversaId)
    return { caminho: this.ficheiros.caminho(m.ficheiro), nome: m.nomeOriginal }
  }
}
