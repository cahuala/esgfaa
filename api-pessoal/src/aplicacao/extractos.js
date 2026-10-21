import { invalido, naoEncontrado } from '../erros.js'
import { POSTOS, nomeDoPosto } from '../dominio/pessoal/hierarquia.js'
import { proximoPosto } from '../dominio/pessoal/carreira.js'
import { proximaCategoria } from '../dominio/pessoal/civis.js'
import { aplicarAlteracao } from './alteracoes.js'
import { exigir } from './sessao.js'
import { comparadorHierarquico } from '../dominio/pessoal/ordem.js'
import { posicoesUnidades } from './ordem.js'

export const TIPOS_EXTRACTO = { promocao: 'Promoção', nomeacao: 'Nomeação', graduacao: 'Graduação', exoneracao: 'Exoneração', reserva: 'Passagem à reserva', reforma: 'Passagem à reforma', progressao: 'Progressão (civis)', curso: 'Nomeação para curso', outro: 'Outro' }
const TIPO_DOCUMENTO = { promocao: 'extracto_promocao', nomeacao: 'extracto_nomeacao', graduacao: 'extracto_graduacao', exoneracao: 'extracto_exoneracao', reserva: 'extracto_reserva', reforma: 'extracto_reforma', progressao: 'extracto_progressao', curso: 'extracto_curso', outro: 'extracto' }
const sem = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const dia = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null)
const MIME = { pdf: 'application/pdf', jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }
const INCLUIR_PESSOA = { cargo: true, graduacoes: true }

/*
  Extractos de ordem que chegam do escalão superior (promoção, nomeação, reforma…). Ao registar, o sistema
  procura no texto os militares (pelo NIP e pelo nome completo) e junta os da proposta enviada; confirma-se a
  lista e aplica-se: as fichas mudam, fica no histórico e o extracto é anexado ao processo individual de cada um.
*/
export class ServicoExtractos {
  constructor({ bd, auditoria, ficheiros, agora = () => new Date() }) {
    Object.assign(this, { bd, auditoria, ficheiros, agora })
  }

  async listar(u, { tipo, estado } = {}) {
    exigir(u, 'ver')
    const l = await this.bd.extracto.findMany({ where: { ...(tipo ? { tipo } : {}), ...(estado ? { estado } : {}) }, include: { _count: { select: { itens: true } } }, orderBy: [{ data: 'desc' }, { id: 'desc' }] })
    return l.map(({ _count, texto, ...e }) => (void texto, { ...e, data: dia(e.data), tipoNome: TIPOS_EXTRACTO[e.tipo], pessoas: _count.itens }))
  }

  async obter(u, id) {
    exigir(u, 'ver')
    const e = await this.bd.extracto.findUnique({ where: { id }, include: { itens: { include: { pessoa: { include: { cargo: true, unidade: true } } }, orderBy: { id: 'asc' } } } })
    if (!e) throw naoEncontrado('Extracto não encontrado.')
    const cargos = new Map((await this.bd.cargo.findMany({ select: { id: true, nome: true } })).map((c) => [c.id, c.nome]))
    // pela ordem hierárquica (posto, unidade, função, antiguidade)
    const cmp = comparadorHierarquico(await posicoesUnidades(this.bd))
    e.itens.sort((a, b) => cmp(a.pessoa, b.pessoa))
    return {
      ...e, data: dia(e.data), tipoNome: TIPOS_EXTRACTO[e.tipo], temTexto: Boolean(e.texto.trim()), texto: undefined,
      itens: e.itens.map((i) => ({
        id: i.id, pessoaId: i.pessoaId, nome: i.pessoa.nome, nip: i.pessoa.nip, numeroAgente: i.pessoa.numeroAgente, ramo: i.pessoa.ramo, fotoId: i.pessoa.fotoId,
        postoAtual: i.pessoa.posto, postoAtualNome: i.pessoa.posto ? nomeDoPosto(i.pessoa.posto, i.pessoa.ramo) : '', categoriaAtual: i.pessoa.categoriaCivil,
        postoNovo: i.postoNovo, postoNovoNome: i.postoNovo ? nomeDoPosto(i.postoNovo, i.pessoa.ramo) : '', cargoId: i.cargoId, cargoNome: i.cargoId ? cargos.get(i.cargoId) : '',
        cargoAtual: i.pessoa.cargo?.nome ?? '', unidadeNome: i.pessoa.unidade?.nome ?? '', encontradoPor: i.encontradoPor, aplicado: i.aplicado,
      })),
    }
  }

  async criar(u, { tipo, numero, data, entidade = '', propostaId = null, texto = '' }, ficheiro) {
    exigir(u, 'editar')
    if (!TIPOS_EXTRACTO[tipo]) throw invalido('Tipo de extracto desconhecido.', 'tipo')
    const f = ficheiro ? await this.ficheiros.guardar(ficheiro) : null
    if (f && f.mime !== 'application/pdf' && !f.mime.startsWith('image/')) {
      this.ficheiros.apagar(f.ficheiro)
      throw invalido('O extracto deve ser um PDF ou uma imagem digitalizada.', 'ficheiro')
    }
    const e = await this.bd.extracto.create({ data: { tipo, numero, data: new Date(data), entidade, propostaId, texto: String(texto).slice(0, 500_000), ficheiro: f?.ficheiro ?? '', nomeOriginal: f?.nomeOriginal ?? '', criadoPor: u.email, criadoEm: this.agora() } })
    const encontrados = await this.#procurar(e)
    await this.auditoria.registar(u, 'registar_extracto', `${TIPOS_EXTRACTO[tipo]} n.º ${numero}`, { encontrados })
    return this.obter(u, e.id)
  }

  // quem o extracto abrange: os da proposta (se indicada), os NIP que aparecem no texto e os nomes completos
  async #procurar(e) {
    const achados = new Map()
    if (e.propostaId) {
      const pr = await this.bd.proposta.findUnique({ where: { id: e.propostaId }, include: { itens: true } })
      for (const i of pr?.itens ?? []) achados.set(i.pessoaId, { por: 'proposta', postoNovo: i.postoProposto, cargoId: i.cargoId })
    }
    const texto = sem(e.texto)
    if (texto) {
      const pessoas = await this.bd.pessoa.findMany({ where: { ativo: true, vinculo: { not: 'domiciliar' } }, select: { id: true, nome: true, nip: true, numeroAgente: true } })
      const palavras = new Set(texto.split(' '))
      for (const p of pessoas) {
        if (achados.has(p.id)) continue
        const ident = sem(p.nip || p.numeroAgente || '')
        if (ident && ident.length >= 4 && palavras.has(ident)) achados.set(p.id, { por: p.nip ? 'nip' : 'agente' })
        else if (sem(p.nome).split(' ').length >= 3 && texto.includes(sem(p.nome))) achados.set(p.id, { por: 'nome' })
      }
    }
    for (const [pessoaId, a] of achados) await this.#novoItem(e, pessoaId, a)
    return achados.size
  }

  async #novoItem(e, pessoaId, { por = 'manual', postoNovo = null, cargoId = null } = {}) {
    const p = await this.bd.pessoa.findUnique({ where: { id: pessoaId } })
    if (!p) throw naoEncontrado('Ficha não encontrada.')
    // posto novo: o da proposta ou, na promoção, o posto imediato
    const posto = postoNovo ?? (e.tipo === 'promocao' ? proximoPosto(p) : null)
    return this.bd.itemExtracto.create({ data: { extractoId: e.id, pessoaId, encontradoPor: por, postoNovo: posto, cargoId } })
  }

  async #pendente(id) {
    const e = await this.bd.extracto.findUnique({ where: { id } })
    if (!e) throw naoEncontrado('Extracto não encontrado.')
    if (e.estado !== 'pendente') throw invalido('Este extracto já foi aplicado às fichas.')
    return e
  }

  async adicionarItem(u, id, { pessoaId, postoNovo = null, cargoId = null }) {
    exigir(u, 'editar')
    const e = await this.#pendente(id)
    if (await this.bd.itemExtracto.findUnique({ where: { extractoId_pessoaId: { extractoId: id, pessoaId } } })) throw invalido('Essa pessoa já está no extracto.')
    await this.#novoItem(e, pessoaId, { por: 'manual', postoNovo, cargoId })
    return this.obter(u, id)
  }

  async editarItem(u, id, itemId, { postoNovo, cargoId }) {
    exigir(u, 'editar')
    await this.#pendente(id)
    if (postoNovo && !POSTOS[postoNovo]) throw invalido('Posto desconhecido.', 'postoNovo')
    await this.bd.itemExtracto.update({ where: { id: itemId, extractoId: id }, data: { ...(postoNovo !== undefined ? { postoNovo: postoNovo || null } : {}), ...(cargoId !== undefined ? { cargoId: cargoId || null } : {}) } })
    return this.obter(u, id)
  }

  async removerItem(u, id, itemId) {
    exigir(u, 'editar')
    await this.#pendente(id)
    await this.bd.itemExtracto.deleteMany({ where: { id: itemId, extractoId: id } })
    return this.obter(u, id)
  }

  async remover(u, id) {
    exigir(u, 'editar')
    const e = await this.#pendente(id)
    await this.bd.extracto.delete({ where: { id } })
    this.ficheiros.apagar(e.ficheiro)
    await this.auditoria.registar(u, 'remover_extracto', `n.º ${e.numero}`)
  }

  // aplica a todos: muda as fichas, regista no histórico, anexa ao processo e conclui as propostas abrangidas
  async aplicar(u, id) {
    exigir(u, 'editar')
    const e = await this.#pendente(id)
    const itens = await this.bd.itemExtracto.findMany({ where: { extractoId: id }, include: { pessoa: { include: INCLUIR_PESSOA } } })
    if (!itens.length) throw invalido('O extracto não tem ninguém: junte as pessoas que abrange.')
    for (const i of itens) {
      const p = i.pessoa
      if (['promocao', 'graduacao'].includes(e.tipo)) {
        if (!i.postoNovo) throw invalido(`${p.nome}: indique o posto.`)
        if (p.tipo !== 'militar' || POSTOS[i.postoNovo].grau <= POSTOS[p.posto].grau) throw invalido(`${p.nome}: o posto indicado não é superior ao atual.`)
      }
      if (e.tipo === 'nomeacao' && !i.cargoId) throw invalido(`${p.nome}: indique o cargo.`)
      if (e.tipo === 'progressao' && !proximaCategoria(p.carreiraCivil, p.categoriaCivil)) throw invalido(`${p.nome}: não há categoria acima.`)
    }
    // nomeação para curso: o curso e as datas vêm da proposta (a do extracto ou a proposta enviada de cada um)
    const cursos = new Map()
    if (e.tipo === 'curso') {
      for (const i of itens) {
        const onde = e.propostaId ? { propostaId: e.propostaId } : { proposta: { tipo: 'curso', estado: 'enviada' } }
        const ip = await this.bd.itemProposta.findFirst({ where: { pessoaId: i.pessoaId, ...onde }, include: { proposta: { select: { curso: true } } } })
        if (!ip?.proposta.curso) throw invalido(`${i.pessoa.nome}: associe o extracto à proposta para curso (é de lá que vem o nome do curso).`)
        cursos.set(i.pessoaId, { curso: ip.proposta.curso, inicio: ip.inicio, fim: ip.fim })
      }
    }
    const doc = { documento: `Extracto n.º ${e.numero}`, entidade: e.entidade, criadoPor: u.email, propostaId: e.propostaId }
    await this.bd.$transaction(async (tx) => {
      for (const i of itens) {
        await aplicarAlteracao(tx, e.tipo, i.pessoa, { postoNovo: i.postoNovo, cargoId: i.cargoId, categoriaNova: proximaCategoria(i.pessoa.carreiraCivil, i.pessoa.categoriaCivil), ...cursos.get(i.pessoaId) }, e.data, doc)
        if (e.ficheiro) await tx.documentoPessoal.create({ data: { pessoaId: i.pessoaId, tipo: TIPO_DOCUMENTO[e.tipo], titulo: `Extracto n.º ${e.numero} — ${TIPOS_EXTRACTO[e.tipo]}`, ficheiro: e.ficheiro, nomeOriginal: e.nomeOriginal, mime: MIME[e.ficheiro.split('.').pop()] ?? 'application/octet-stream', tamanho: 0, data: e.data, extractoId: e.id, criadoPor: u.email } })
        await tx.itemExtracto.update({ where: { id: i.id }, data: { aplicado: true } })
      }
      await tx.extracto.update({ where: { id }, data: { estado: 'aplicado', aplicadoEm: this.agora() } })
      // propostas enviadas cujos militares já estão todos em extractos aplicados deste tipo ficam concluídas
      const tipoProposta = e.tipo === 'reserva' || e.tipo === 'reforma' ? null : e.tipo
      if (tipoProposta) {
        const abertas = await tx.proposta.findMany({ where: { estado: 'enviada', tipo: tipoProposta, itens: { some: { pessoaId: { in: itens.map((i) => i.pessoaId) } } } }, include: { itens: true } })
        for (const pr of abertas) {
          const feitos = await tx.itemExtracto.findMany({ where: { aplicado: true, pessoaId: { in: pr.itens.map((x) => x.pessoaId) }, extracto: { tipo: e.tipo, criadoEm: { gte: pr.submetidaEm ?? pr.criadoEm } } }, select: { pessoaId: true } })
          if (new Set(feitos.map((x) => x.pessoaId)).size === pr.itens.length) await tx.proposta.update({ where: { id: pr.id }, data: { estado: 'concluida', extractoId: e.id, documento: `Extracto n.º ${e.numero}`, dataDocumento: e.data, entidade: e.entidade, decididaEm: this.agora(), decididoPor: u.email } })
        }
      }
    })
    await this.auditoria.registar(u, 'aplicar_extracto', `${TIPOS_EXTRACTO[e.tipo]} n.º ${e.numero}`, { pessoas: itens.length })
    return this.obter(u, id)
  }

  async ficheiro(u, id) {
    exigir(u, 'ver')
    const e = await this.bd.extracto.findUnique({ where: { id }, select: { ficheiro: true, nomeOriginal: true } })
    if (!e?.ficheiro) throw naoEncontrado('Este extracto não tem ficheiro.')
    return { caminho: this.ficheiros.caminho(e.ficheiro), nome: e.nomeOriginal }
  }
}
