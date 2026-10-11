import crypto from 'node:crypto'
import { Conflito, NaoEncontrado } from '../dominio/comum/erros.js'
import { ESTADOS_FINAIS, validarAvaliacao, validarCandidatura } from '../dominio/admissao/candidatura.js'

const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // sem 0/O e 1/I, para ler ao telefone

// "ESG-2026-7K4Q9M": referência que o candidato guarda para acompanhar o pedido
export function gerarCodigo(ano) {
  const sufixo = Array.from({ length: 6 }, () => LETRAS[crypto.randomInt(LETRAS.length)]).join('')
  return `ESG-${ano}-${sufixo}`
}

// Candidaturas aos cursos: submissão pública e avaliação pela Secretaria Académica
export class ServicoCandidaturas {
  constructor({ candidaturas, conteudos, auditoria, relogio }) {
    Object.assign(this, { candidaturas, conteudos, auditoria, relogio })
  }

  async submeter(entrada, ctx) {
    const agora = this.relogio.agora()
    const cursos = (await this.conteudos.listar('cursos', { soPublicados: true })).map((c) => c.id)
    const c = validarCandidatura(entrada, { cursos, hoje: agora })

    if (await this.candidaturas.existeEmCurso(c.email, c.curso, ESTADOS_FINAIS)) {
      throw new Conflito('Já existe uma candidatura com este e-mail a este curso, em análise. A Secretaria Académica entrará em contacto.')
    }

    let criada
    for (let tentativa = 0; !criada; tentativa++) {
      try {
        criada = await this.candidaturas.criar({ ...c, codigo: gerarCodigo(agora.getFullYear()), ip: ctx.ip })
      } catch (erro) {
        if (!(erro instanceof Conflito) || tentativa >= 4) throw erro
      }
    }
    await this.auditoria.registar(ctx, {
      acao: 'nova_candidatura', colecao: 'candidaturas', alvoId: criada.id, alvoTitulo: `${criada.nome} (${criada.codigo})`,
      detalhes: { curso: criada.curso }, utilizador: null,
    })
    return { codigo: criada.codigo, curso: criada.curso, nome: criada.nome, email: criada.email }
  }

  async listar(ctx, filtros) {
    ctx.actor.exigir('candidaturas.ver')
    const [lista, porEstado] = await Promise.all([this.candidaturas.listar(filtros), this.candidaturas.contarPorEstado()])
    return { lista, porEstado }
  }

  async ler(ctx, id) {
    ctx.actor.exigir('candidaturas.ver')
    const c = await this.candidaturas.porId(id)
    if (!c) throw new NaoEncontrado('Candidatura não encontrada.')
    return c
  }

  async avaliar(ctx, id, corpo) {
    ctx.actor.exigir('candidaturas.editar')
    const atual = await this.candidaturas.porId(id)
    if (!atual) throw new NaoEncontrado('Candidatura não encontrada.')
    const mudanca = validarAvaliacao(corpo)
    const nova = await this.candidaturas.atualizar(atual.id, mudanca, ctx.actor.id)
    await this.auditoria.registar(ctx, {
      acao: 'avaliar_candidatura', colecao: 'candidaturas', alvoId: atual.id, alvoTitulo: `${atual.nome} (${atual.codigo})`,
      detalhes: { de: atual.estado, para: nova.estado, notas: mudanca.notas !== undefined },
    })
    return nova
  }
}
