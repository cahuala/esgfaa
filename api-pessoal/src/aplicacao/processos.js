import { conflito, invalido, naoEncontrado } from '../erros.js'
import { eDuplicado } from '../infraestrutura/bd.js'
import { abreviaturaDoPosto, nomeDoPosto } from '../dominio/pessoal/hierarquia.js'
import { exigir } from './sessao.js'

export const TIPOS_DOCUMENTO = {
  bi: 'Bilhete de Identidade', foto: 'Fotografia', certificado: 'Certificado de habilitações', diploma: 'Diploma de curso militar',
  extracto_promocao: 'Extracto de promoção', extracto_nomeacao: 'Extracto de nomeação', extracto_graduacao: 'Extracto de graduação', extracto_exoneracao: 'Extracto de exoneração',
  extracto_reserva: 'Extracto de passagem à reserva', extracto_reforma: 'Extracto de reforma', extracto_progressao: 'Extracto de progressão', extracto_curso: 'Extracto de nomeação para curso', extracto: 'Extracto',
  louvor: 'Louvor / condecoração', punicao: 'Punição', saude: 'Inspecção médica', contrato: 'Contrato', declaracao: 'Declaração', outro: 'Outro',
}
export const ESTADOS_PROCESSO = { activo: 'Activo', encapado: 'Encapado', em_falta: 'Pasta em falta', arquivado: 'Arquivado' }
const dia = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null)

// o que falta na ficha para o processo individual estar actualizado
export function dadosEmFalta(p, docs = []) {
  const f = []
  const falta = (cond, texto) => { if (!cond) f.push(texto) }
  falta(p.bi, 'N.º do BI'); falta(p.dataNascimento, 'Data de nascimento'); falta(p.genero, 'Género'); falta(p.fotoId, 'Fotografia')
  falta(p.telefone, 'Telefone'); falta(p.habilitacao, 'Habilitações'); falta(p.pai || p.mae, 'Filiação'); falta(p.provincia, 'Naturalidade (província)')
  falta(p.unidadeId, 'Unidade')
  if (p.tipo === 'militar') {
    falta(p.dataIngresso, 'Data de ingresso nas FAA'); falta(p.dataAntiguidadePosto, 'Antiguidade no posto'); falta(p.quadroEspecial, 'Quadro especial')
    falta(docs.some((d) => d.tipo === 'extracto_promocao'), 'Extracto de promoção ao posto actual')
  } else falta(p.dataAdmissao, 'Data de admissão')
  falta(docs.some((d) => d.tipo === 'bi'), 'Cópia do BI digitalizada')
  return f
}

/*
  Processos individuais: n.º PI-NNNNN de cada pessoa, onde está a pasta física
  (estante > prateleira > posição), o estado, os documentos digitalizados e o que falta actualizar.
*/
export class ServicoProcessos {
  constructor({ bd, auditoria, ficheiros }) {
    Object.assign(this, { bd, auditoria, ficheiros })
  }

  async catalogo(u, { incompletos } = {}) {
    exigir(u, 'ver')
    const l = await this.bd.pessoa.findMany({ where: { ativo: true, vinculo: { not: 'domiciliar' } }, include: { processo: true, unidade: { select: { nome: true } }, documentos: { select: { tipo: true } } }, orderBy: { nome: 'asc' } })
    const r = l.map((p) => {
      const falta = dadosEmFalta(p, p.documentos)
      return {
        id: p.id, nome: p.nome, tipo: p.tipo, nip: p.nip, numeroAgente: p.numeroAgente, ramo: p.ramo, fotoId: p.fotoId, postoNome: p.posto ? nomeDoPosto(p.posto, p.ramo) : p.categoriaCivil || 'Civil',
        unidadeNome: p.unidade?.nome ?? '', numero: p.processo?.numero ?? '', estante: p.processo?.estante ?? '', prateleira: p.processo?.prateleira ?? '', posicao: p.processo?.posicao ?? '', abreviatura: p.posto ? abreviaturaDoPosto(p.posto, p.ramo) : '', localizacao: p.processo ? [p.processo.estante, p.processo.prateleira, p.processo.posicao].filter(Boolean).join(' › ') : '',
        estado: p.processo?.estado ?? '', estadoNome: ESTADOS_PROCESSO[p.processo?.estado] ?? 'Sem processo', documentos: p.documentos.length, emFalta: falta, completo: !falta.length,
      }
    })
    return incompletos ? r.filter((x) => !x.completo) : r
  }

  async guardar(u, pessoaId, { estante = '', prateleira = '', posicao = '', estado = 'activo', observacoes = '' }) {
    exigir(u, 'editar')
    if (!ESTADOS_PROCESSO[estado]) throw invalido('Estado desconhecido.', 'estado')
    const p = await this.bd.pessoa.findUnique({ where: { id: pessoaId }, include: { processo: true } })
    if (!p) throw naoEncontrado('Ficha não encontrada.')
    const dados = { estante, prateleira, posicao, estado, observacoes }
    if (estante && prateleira && posicao) {
      const ocupada = await this.bd.processo.findFirst({ where: { estante, prateleira, posicao, pessoaId: { not: pessoaId } }, include: { pessoa: { select: { nome: true } } } })
      if (ocupada) throw conflito(`Essa posição da estante já tem o processo ${ocupada.numero} (${ocupada.pessoa.nome}).`)
    }
    if (p.processo) return this.bd.processo.update({ where: { pessoaId }, data: dados })
    // n.º sequencial PI-00001; se dois pedidos chegarem ao mesmo tempo, tenta o seguinte
    for (let t = 0; t < 5; t++) {
      const n = (await this.bd.processo.count()) + 1 + t
      try {
        const r = await this.bd.processo.create({ data: { ...dados, pessoaId, numero: `PI-${String(n).padStart(5, '0')}` } })
        await this.auditoria.registar(u, 'abrir_processo', `${r.numero}: ${p.nome}`)
        return r
      } catch (e) {
        if (!eDuplicado(e)) throw e
      }
    }
    throw conflito('Não foi possível numerar o processo. Tente de novo.')
  }

  async documentos(u, pessoaId) {
    exigir(u, 'ver')
    return (await this.bd.documentoPessoal.findMany({ where: { pessoaId }, orderBy: [{ data: 'desc' }, { id: 'desc' }] })).map((d) => ({ ...d, data: dia(d.data), tipoNome: TIPOS_DOCUMENTO[d.tipo] ?? d.tipo }))
  }

  async adicionarDocumento(u, pessoaId, { tipo, titulo, data }, ficheiro) {
    exigir(u, 'editar')
    if (!TIPOS_DOCUMENTO[tipo]) throw invalido('Tipo de documento desconhecido.', 'tipo')
    if (!(await this.bd.pessoa.count({ where: { id: pessoaId } }))) throw naoEncontrado('Ficha não encontrada.')
    const f = await this.ficheiros.guardar(ficheiro)
    const d = await this.bd.documentoPessoal.create({ data: { pessoaId, tipo, titulo: titulo || TIPOS_DOCUMENTO[tipo], data: data ? new Date(data) : null, ...f, criadoPor: u.email } })
    await this.auditoria.registar(u, 'anexar_documento', `${d.titulo} (ficha #${pessoaId})`)
    return { ...d, data: dia(d.data), tipoNome: TIPOS_DOCUMENTO[d.tipo] }
  }

  async ficheiro(u, id) {
    exigir(u, 'ver')
    const d = await this.bd.documentoPessoal.findUnique({ where: { id } })
    if (!d) throw naoEncontrado('Documento não encontrado.')
    await this.auditoria.registar(u, 'abrir_documento', `${d.titulo} (ficha #${d.pessoaId})`)
    return { caminho: this.ficheiros.caminho(d.ficheiro), nome: d.nomeOriginal, mime: d.mime }
  }

  async removerDocumento(u, id) {
    exigir(u, 'editar')
    const d = await this.bd.documentoPessoal.findUnique({ where: { id } })
    if (!d) throw naoEncontrado('Documento não encontrado.')
    await this.bd.documentoPessoal.delete({ where: { id } })
    // o mesmo extracto pode estar no processo de vários: só se apaga o ficheiro quando ninguém o usa
    const usado = (await this.bd.documentoPessoal.count({ where: { ficheiro: d.ficheiro } })) + (await this.bd.extracto.count({ where: { ficheiro: d.ficheiro } }))
    if (!usado) this.ficheiros.apagar(d.ficheiro)
    await this.auditoria.registar(u, 'remover_documento', `${d.titulo} (ficha #${d.pessoaId})`)
  }
}
