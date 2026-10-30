import { invalido, naoEncontrado, semPermissao } from '../erros.js'
import { eDuplicado } from '../infraestrutura/bd.js'
import { exigir, pode } from './sessao.js'

export const TIPOS_EXPEDIENTE = { oficio: 'Ofício', nota: 'Nota', informacao: 'Informação', requerimento: 'Requerimento', relatorio: 'Relatório', ordem: 'Ordem de serviço', convocatoria: 'Convocatória', circular: 'Circular', parecer: 'Parecer', proposta: 'Proposta', extracto: 'Extracto', declaracao: 'Declaração', guia: 'Guia de marcha', outro: 'Outro' }
export const CLASSIFICACOES = { normal: 'Normal', urgente: 'Urgente', confidencial: 'Confidencial' }
export const SENTIDOS = { interno: 'Interno', entrada: 'Entrada (de fora da Escola)', saida: 'Saída (para fora da Escola)' }
const FISICO = { nao_aplica: 'Sem original físico', a_enviar: 'Original por entregar', entregue: 'Original entregue (a confirmar)', recebido: 'Original recebido' }

/*
  Expediente da Escola: cada área (unidade) envia documentos às outras pelo sistema, com protocolo
  (EXP-AAAA-NNNN), anexos digitalizados e o percurso completo. Quem recebe confirma a recepção, pode
  encaminhar a outra área ou arquivar. Se houver original em papel, cada passo diz quem o levou e quando
  chegou (o físico segue depois do digital).
*/
export class ServicoExpediente {
  constructor({ bd, auditoria, ficheiros, agora = () => new Date() }) {
    Object.assign(this, { bd, auditoria, ficheiros, agora })
  }

  #unidade(u) {
    if (!u.unidadeId) throw invalido('A sua conta não está ligada a nenhuma unidade: peça ao administrador para a indicar.')
    return u.unidadeId
  }

  // vê o documento quem está numa unidade por onde passou (o administrador, o Chefe e o Comandante veem o livro todo)
  #podeVer(u, x) {
    if (pode(u, 'administrar') || pode(u, 'supervisionar')) return true
    return x.origemUnidadeId === u.unidadeId || x.movimentos.some((m) => m.paraUnidadeId === u.unidadeId || m.deUnidadeId === u.unidadeId)
  }

  #resumo(x, u, unidades) {
    const ultimo = x.movimentos.at(-1)
    const meus = x.movimentos.filter((m) => m.paraUnidadeId === u.unidadeId)
    const porReceber = meus.some((m) => !m.recebidoEm)
    const nome = (id) => unidades.get(id) ?? (id ? `#${id}` : '')
    return {
      id: x.id, protocolo: x.protocolo, sentido: x.sentido, tipo: x.tipo, tipoNome: TIPOS_EXPEDIENTE[x.tipo] ?? x.tipo, numero: x.numero, assunto: x.assunto, classificacao: x.classificacao,
      estado: x.estado, armario: x.armario, prateleira: x.prateleira, pasta: x.pasta, arquivadoEm: x.arquivadoEm, criadoEm: x.criadoEm, prazo: x.prazo?.toISOString().slice(0, 10) ?? null, temFisico: x.temFisico, anexos: x.anexos?.length ?? x._count?.anexos ?? 0,
      origem: x.entidadeExterna || nome(x.origemUnidadeId), localAtual: ultimo ? nome(ultimo.paraUnidadeId) : nome(x.origemUnidadeId),
      porReceber, fisicoPendente: x.movimentos.some((m) => m.paraUnidadeId === u.unidadeId && ['a_enviar', 'entregue'].includes(m.fisico)),
      naMinhaUnidade: (ultimo?.paraUnidadeId ?? x.origemUnidadeId) === u.unidadeId, enviadoPorMim: x.origemUnidadeId === u.unidadeId || x.movimentos.some((m) => m.deUnidadeId === u.unidadeId),
    }
  }

  async #unidades() {
    return new Map((await this.bd.unidade.findMany({ select: { id: true, nome: true } })).map((x) => [x.id, x.nome]))
  }

  // caixas: por_receber | na_unidade | enviados | arquivo | todos (livro: administrador, Chefe e Comandante)
  // livro e arquivo: também por período (de/até, pela data de registo), sentido e armário
  async listar(u, { caixa = 'por_receber', de, ate, sentido, armario } = {}) {
    exigir(u, 'expediente')
    const livro = caixa === 'todos'
    // o livro todo: o administrador, o Chefe de Pessoal e o Comandante; as caixas: a unidade de cada um
    if (livro) { if (!pode(u, 'administrar')) exigir(u, 'supervisionar') } else this.#unidade(u)
    const where = livro ? {} : { OR: [{ origemUnidadeId: u.unidadeId }, { movimentos: { some: { OR: [{ paraUnidadeId: u.unidadeId }, { deUnidadeId: u.unidadeId }] } } }] }
    if (de || ate) where.criadoEm = { ...(de ? { gte: new Date(`${de}T00:00:00`) } : {}), ...(ate ? { lte: new Date(`${ate}T23:59:59.999`) } : {}) }
    if (sentido) where.sentido = sentido
    if (armario) where.armario = armario
    const l = await this.bd.expediente.findMany({ where, include: { movimentos: { orderBy: { id: 'asc' } }, _count: { select: { anexos: true } } }, orderBy: { criadoEm: 'desc' }, take: 3000 })
    const unidades = await this.#unidades()
    const r = l.map((x) => this.#resumo(x, u, unidades))
    if (caixa === 'por_receber') return r.filter((x) => x.porReceber || x.fisicoPendente)
    if (caixa === 'na_unidade') return r.filter((x) => x.estado === 'em_curso' && x.naMinhaUnidade && !x.porReceber)
    if (caixa === 'enviados') return r.filter((x) => x.enviadoPorMim)
    if (caixa === 'arquivo') return r.filter((x) => x.estado === 'arquivado')
    return r
  }

  async contadores(u) {
    if (!u.unidadeId) return { porReceber: 0 }
    const porReceber = await this.bd.movimento.count({ where: { paraUnidadeId: u.unidadeId, recebidoEm: null } })
    return { porReceber }
  }

  async obter(u, id) {
    exigir(u, 'expediente')
    const x = await this.bd.expediente.findUnique({ where: { id }, include: { anexos: { orderBy: { id: 'asc' } }, movimentos: { orderBy: { id: 'asc' } } } })
    if (!x) throw naoEncontrado('Documento não encontrado.')
    if (!this.#podeVer(u, x)) throw semPermissao('Este documento não passou pela sua unidade.')
    const unidades = await this.#unidades()
    const ids = [...new Set([x.criadoPorId, ...x.movimentos.flatMap((m) => [m.enviadoPorId, m.recebidoPorId]), ...x.anexos.map((a) => a.criadoPorId)].filter(Boolean))]
    const pessoas = new Map((await this.bd.utilizador.findMany({ where: { id: { in: ids } }, select: { id: true, nome: true } })).map((p) => [p.id, p.nome]))
    return {
      ...this.#resumo(x, u, unidades), resumo: x.resumo, entidadeExterna: x.entidadeExterna, criadoPor: pessoas.get(x.criadoPorId) ?? '', origemUnidadeId: x.origemUnidadeId,
      anexos: x.anexos.map((a) => ({ id: a.id, nome: a.nomeOriginal, mime: a.mime, tamanho: a.tamanho, criadoEm: a.criadoEm, por: pessoas.get(a.criadoPorId) ?? '' })),
      movimentos: x.movimentos.map((m) => ({ ...m, de: unidades.get(m.deUnidadeId) ?? (x.entidadeExterna || ''), para: unidades.get(m.paraUnidadeId) ?? '', enviadoPor: pessoas.get(m.enviadoPorId) ?? '', recebidoPor: pessoas.get(m.recebidoPorId) ?? '', fisicoNome: FISICO[m.fisico] })),
    }
  }

  async criar(u, d, ficheiros = []) {
    exigir(u, 'expediente')
    const minha = this.#unidade(u)
    const destinos = [...new Set((d.destinos ?? []).map(Number))].filter((x) => x !== minha)
    if (d.sentido !== 'entrada' && !destinos.length && d.sentido !== 'saida') throw invalido('Escolha a(s) área(s) para onde vai o documento.', 'destinos')
    const guardados = []
    for (const f of ficheiros) guardados.push(await this.ficheiros.guardar(f))
    const ano = this.agora().getUTCFullYear()
    let x
    for (let t = 0; !x; t++) {
      const n = (await this.bd.expediente.count({ where: { protocolo: { startsWith: `EXP-${ano}-` } } })) + 1 + t
      try {
        x = await this.bd.$transaction(async (tx) => {
          const e = await tx.expediente.create({ data: { protocolo: `EXP-${ano}-${String(n).padStart(4, '0')}`, sentido: d.sentido, tipo: d.tipo, numero: d.numero ?? '', assunto: d.assunto, resumo: d.resumo ?? '', classificacao: d.classificacao, origemUnidadeId: d.sentido === 'entrada' ? null : minha, entidadeExterna: d.entidadeExterna ?? '', temFisico: Boolean(d.temFisico), prazo: d.prazo ? new Date(d.prazo) : null, criadoPorId: u.id } })
          for (const g of guardados) await tx.anexoExpediente.create({ data: { expedienteId: e.id, ...g, criadoPorId: u.id } })
          // entrada de fora: fica registada na unidade que a recebeu, já recebida
          if (d.sentido === 'entrada') await tx.movimento.create({ data: { expedienteId: e.id, deUnidadeId: null, paraUnidadeId: minha, nota: 'Entrada na Escola', enviadoPorId: u.id, recebidoPorId: u.id, recebidoEm: this.agora(), fisico: d.temFisico ? 'recebido' : 'nao_aplica', fisicoRecebidoEm: d.temFisico ? this.agora() : null } })
          for (const para of destinos) await tx.movimento.create({ data: { expedienteId: e.id, deUnidadeId: minha, paraUnidadeId: para, nota: d.nota ?? '', enviadoPorId: u.id, fisico: d.temFisico ? 'a_enviar' : 'nao_aplica', fisicoPortador: d.portador ?? '' } })
          return e
        })
      } catch (e) {
        if (!eDuplicado(e) || t > 5) {
          for (const g of guardados) this.ficheiros.apagar(g.ficheiro)
          throw e
        }
      }
    }
    await this.auditoria.registar(u, 'registar_expediente', `${x.protocolo}: ${x.assunto}`, { destinos })
    return this.obter(u, x.id)
  }

  // confirma a recepção (digital) do que chegou à unidade; com fisico, confirma também o original em papel
  async receber(u, id, { fisico = false } = {}) {
    exigir(u, 'expediente')
    const minha = this.#unidade(u)
    const pendentes = await this.bd.movimento.findMany({ where: { expedienteId: id, paraUnidadeId: minha, OR: [{ recebidoEm: null }, ...(fisico ? [{ fisico: { in: ['a_enviar', 'entregue'] } }] : [])] } })
    if (!pendentes.length) throw invalido('Não há nada por receber neste documento.')
    for (const m of pendentes) {
      await this.bd.movimento.update({ where: { id: m.id }, data: { ...(m.recebidoEm ? {} : { recebidoEm: this.agora(), recebidoPorId: u.id }), ...(fisico && m.fisico !== 'nao_aplica' ? { fisico: 'recebido', fisicoRecebidoEm: this.agora() } : {}) } })
    }
    await this.auditoria.registar(u, fisico ? 'receber_original' : 'receber_expediente', `#${id}`)
    return this.obter(u, id)
  }

  // quem enviou regista que o original em papel foi entregue (e por quem)
  async entregarFisico(u, id, movimentoId, { portador = '' }) {
    exigir(u, 'expediente')
    const m = await this.bd.movimento.findFirst({ where: { id: movimentoId, expedienteId: id } })
    if (!m) throw naoEncontrado('Passo não encontrado.')
    if (m.deUnidadeId !== u.unidadeId) throw semPermissao('Só a unidade que enviou regista a entrega do original.')
    if (m.fisico !== 'a_enviar') throw invalido('O original deste passo já foi entregue ou não existe.')
    await this.bd.movimento.update({ where: { id: m.id }, data: { fisico: 'entregue', fisicoPortador: portador } })
    return this.obter(u, id)
  }

  async encaminhar(u, id, { destinos = [], nota = '', fisico = false, portador = '' }) {
    exigir(u, 'expediente')
    const minha = this.#unidade(u)
    const x = await this.obter(u, id)
    if (x.estado !== 'em_curso') throw invalido('O documento está arquivado: reabra-o primeiro.')
    if (!x.naMinhaUnidade || x.porReceber) throw invalido('Só se encaminha um documento que está na sua unidade e já foi recebido.')
    const para = [...new Set(destinos.map(Number))].filter((d) => d !== minha)
    if (!para.length) throw invalido('Escolha para onde encaminhar.', 'destinos')
    for (const p of para) await this.bd.movimento.create({ data: { expedienteId: id, deUnidadeId: minha, paraUnidadeId: p, nota, enviadoPorId: u.id, fisico: fisico && x.temFisico ? 'a_enviar' : 'nao_aplica', fisicoPortador: portador } })
    await this.auditoria.registar(u, 'encaminhar_expediente', `${x.protocolo}`, { para })
    return this.obter(u, id)
  }

  // arquivar diz onde fica o original em papel (armário, prateleira, pasta); reabrir mantém o sítio
  async arquivar(u, id, arquivar = true, { armario = '', prateleira = '', pasta = '' } = {}) {
    exigir(u, 'expediente')
    const x = await this.obter(u, id)
    if (!x.naMinhaUnidade && !pode(u, 'administrar')) throw semPermissao('Só a unidade onde o documento está o arquiva.')
    const sitio = arquivar ? { armario: armario.trim(), prateleira: prateleira.trim(), pasta: pasta.trim(), arquivadoEm: this.agora() } : {}
    await this.bd.expediente.update({ where: { id }, data: { estado: arquivar ? 'arquivado' : 'em_curso', ...sitio } })
    await this.auditoria.registar(u, arquivar ? 'arquivar_expediente' : 'reabrir_expediente', [x.protocolo, sitio.armario && `armário ${sitio.armario}`, sitio.prateleira && `prateleira ${sitio.prateleira}`, sitio.pasta && `pasta ${sitio.pasta}`].filter(Boolean).join(' · '))
    return this.obter(u, id)
  }

  async anexar(u, id, ficheiros) {
    exigir(u, 'expediente')
    const x = await this.obter(u, id)
    if (!x.naMinhaUnidade) throw semPermissao('Só a unidade onde o documento está junta anexos.')
    if (!ficheiros.length) throw invalido('Escolha o(s) ficheiro(s).')
    for (const f of ficheiros) await this.bd.anexoExpediente.create({ data: { expedienteId: id, ...(await this.ficheiros.guardar(f)), criadoPorId: u.id } })
    return this.obter(u, id)
  }

  async anexo(u, anexoId) {
    exigir(u, 'expediente')
    const a = await this.bd.anexoExpediente.findUnique({ where: { id: anexoId } })
    if (!a) throw naoEncontrado('Anexo não encontrado.')
    await this.obter(u, a.expedienteId) // verifica o acesso
    return { caminho: this.ficheiros.caminho(a.ficheiro), nome: a.nomeOriginal, mime: a.mime }
  }

  async unidadesDestino(u) {
    exigir(u, 'expediente')
    return this.bd.unidade.findMany({ select: { id: true, nome: true, sigla: true, paiId: true }, orderBy: [{ ordem: 'asc' }, { nome: 'asc' }] })
  }
}
