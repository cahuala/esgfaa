import { invalido, naoEncontrado } from '../erros.js'
import { exigir } from './sessao.js'

/*
  Documentos pessoais emitidos a partir da ficha (declarações, guias de marcha, fichas…). Cada emissão fica
  registada (quem, quando, com que opções); as declarações têm um número por ano: «N.º 402/26».
  Quem assina (o Comandante, o Chefe da Repartição…) define-se uma vez, em «assinaturas».
*/
export const TIPOS_DOCUMENTO_PESSOAL = {
  declaracao_efectividade: { nome: 'Declaração de efectividade', serie: 'declaracao' },
  declaracao_salario: { nome: 'Declaração de salário', serie: 'declaracao' },
  declaracao_servico: { nome: 'Declaração de serviço', serie: 'declaracao' },
  guia_ferias: { nome: 'Guia de marcha — férias' },
  guia_licenca: { nome: 'Guia de marcha — licença disciplinar' },
  guia_dispensa: { nome: 'Guia de marcha — dispensa' },
  guia_apresentacao: { nome: 'Guia de marcha — apresentação' },
  ficha_individual: { nome: 'Ficha individual' },
  ficha_mecanografica: { nome: 'Ficha mecanográfica' },
  ficha_registo_biografico: { nome: 'Ficha de registo biográfico' },
  ficha_disciplinar: { nome: 'Ficha disciplinar' },
  ficha_avaliacao: { nome: 'Ficha de avaliação individual (FAI)' },
  proposta_nomeacao: { nome: 'Proposta de nomeação' },
  processo_promocao: { nome: 'Processo individual de promoção (PIP)' },
  sintese_biografica: { nome: 'Síntese biográfica' },
}

const ASSINATURAS = {
  comandante: { cargo: 'O COMANDANTE DA ESG', nome: '', posto: '' },
  chefeRpq: { cargo: 'O CHEFE DA REPARTIÇÃO DE PESSOAL E QUADROS', nome: '', posto: '' },
  local: 'Luanda',
}

export class ServicoDocumentosEmitidos {
  constructor({ bd, auditoria, agora = () => new Date() }) {
    Object.assign(this, { bd, auditoria, agora })
  }

  async assinaturas(u) {
    exigir(u, 'ver')
    const d = await this.bd.definicao.findUnique({ where: { chave: 'assinaturas' } })
    return { ...ASSINATURAS, ...(d?.valor ?? {}) }
  }

  async guardarAssinaturas(u, valor) {
    exigir(u, 'administrar')
    await this.bd.definicao.upsert({ where: { chave: 'assinaturas' }, create: { chave: 'assinaturas', valor }, update: { valor } })
    await this.auditoria.registar(u, 'definir_assinaturas', 'Assinaturas dos documentos')
    return this.assinaturas(u)
  }

  // regista os documentos escolhidos; as declarações recebem o número seguinte da série no ano
  async emitir(u, pessoaId, documentos) {
    exigir(u, 'editar')
    const p = await this.bd.pessoa.findUnique({ where: { id: pessoaId }, select: { id: true, nome: true } })
    if (!p) throw naoEncontrado('Ficha não encontrada.')
    if (!documentos.length) throw invalido('Escolha pelo menos um documento.')
    for (const d of documentos) if (!TIPOS_DOCUMENTO_PESSOAL[d.tipo]) throw invalido(`Documento desconhecido: ${d.tipo}.`)
    const ano = this.agora().getFullYear()
    const r = []
    for (const d of documentos) {
      const serie = TIPOS_DOCUMENTO_PESSOAL[d.tipo].serie ?? ''
      // número seguinte da série; repete se dois pedidos em paralelo apanharem o mesmo (único na base)
      for (let tentativa = 0; ; tentativa++) {
        try {
          const numero = serie ? ((await this.bd.documentoEmitido.aggregate({ where: { serie, ano }, _max: { numero: true } }))._max.numero ?? 0) + 1 : null
          r.push(await this.bd.documentoEmitido.create({ data: { pessoaId, tipo: d.tipo, serie, ano, numero, dados: d.dados ?? {}, emitidoPor: u.email, criadoEm: this.agora() } }))
          break
        } catch (e) {
          if (e?.code !== 'P2002' || tentativa > 4) throw e
        }
      }
    }
    await this.auditoria.registar(u, 'emitir_documentos', `${p.nome} (#${p.id})`, { documentos: documentos.map((d) => d.tipo) })
    return r.map((x) => ({ id: x.id, tipo: x.tipo, nome: TIPOS_DOCUMENTO_PESSOAL[x.tipo].nome, numero: x.numero, ano: x.ano, criadoEm: x.criadoEm }))
  }

  async historico(u, pessoaId) {
    exigir(u, 'ver')
    const l = await this.bd.documentoEmitido.findMany({ where: { pessoaId }, orderBy: { criadoEm: 'desc' }, take: 200 })
    return l.map((x) => ({ id: x.id, tipo: x.tipo, nome: TIPOS_DOCUMENTO_PESSOAL[x.tipo]?.nome ?? x.tipo, numero: x.numero, ano: x.ano, dados: x.dados, emitidoPor: x.emitidoPor, criadoEm: x.criadoEm }))
  }
}
