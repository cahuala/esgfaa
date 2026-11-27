import { ErroValidacao, NaoEncontrado } from '../../../dominio/comum/erros.js'
import { escolha, texto } from '../../../dominio/academico/comum/validacao.js'
import { ESTADOS_PEDIDO, TIPOS_PEDIDO } from '../../../dominio/academico/secretaria/pedidos.js'

// Pedidos de documentos dos estudantes, tratados pela Administração Escolar.
export class ServicoPedidos {
  constructor(dependencias) {
    Object.assign(this, dependencias)
  }

  listarPedidos(ctx, { estado } = {}) {
    ctx.actor.exigir('academico.ver')
    return this.academico.pedidos({ estado })
  }

  // a Repartição regista um pedido em nome do estudante (feito ao balcão, por ofício ou por telefone)
  async criarPedido(ctx, { estudanteId, tipo, motivo }) {
    ctx.actor.exigir('academico.gerir')
    const e = await this.contas.porId(Number(estudanteId))
    if (!e || e.tipo !== 'estudante') throw new NaoEncontrado('Estudante não encontrado.')
    const p = await this.academico.criarPedido({
      estudanteId: e.id,
      tipo: escolha(tipo, 'tipo', 'Tipo de documento', TIPOS_PEDIDO),
      motivo: texto(motivo, 'motivo', 'Motivo', { max: 1000, obrigatorio: tipo === 'Outro', min: tipo === 'Outro' ? 5 : 1 }),
    })
    await this.auditoria.registar(ctx, { acao: 'pedido_documento_balcao', colecao: 'pedidos', alvoId: p.id, alvoTitulo: `${p.tipo} — ${e.nome}` })
    return p
  }

  tiposPedido(ctx) {
    ctx.actor.exigir('academico.ver')
    return TIPOS_PEDIDO
  }

  async tratarPedido(ctx, id, { estado, resposta }, ficheiro) {
    try {
      ctx.actor.exigir('academico.gerir')
    } catch (e) {
      if (ficheiro) this.privados.apagar(ficheiro.caminho)
      throw e
    }
    const p = await this.academico.pedido(id)
    if (!p) {
      if (ficheiro) this.privados.apagar(ficheiro.caminho)
      throw new NaoEncontrado('Pedido não encontrado.')
    }
    let ficheiroId
    if (ficheiro) {
      if (!this.privados.confirmarTipo(ficheiro.caminho, ficheiro.tipo)) {
        this.privados.apagar(ficheiro.caminho)
        throw new ErroValidacao('O ficheiro não corresponde ao tipo indicado.', { campo: 'ficheiro' })
      }
      ficheiroId = ficheiro.caminho.split(/[\\/]/).pop().split('.')[0]
      await this.academico.criarFicheiro({ id: ficheiroId, caminho: this.privados.relativo(ficheiro.caminho), nome: ficheiro.nome, tipo: ficheiro.tipo, tamanho: ficheiro.tamanho })
    }
    const r = await this.academico.atualizarPedido(p.id, {
      ...(estado !== undefined ? { estado: escolha(estado, 'estado', 'Estado', ESTADOS_PEDIDO) } : {}),
      ...(resposta !== undefined ? { resposta: texto(resposta, 'resposta', 'Resposta', { max: 2000, obrigatorio: false }) } : {}),
      ...(ficheiroId ? { ficheiroId } : {}),
    })
    await this.auditoria.registar(ctx, { acao: 'tratar_pedido', colecao: 'pedidos', alvoId: p.id, alvoTitulo: p.tipo, detalhes: { de: p.estado, para: r.estado } })
    if (r.estado !== p.estado && ['pronto', 'recusado', 'em_tratamento'].includes(r.estado)) {
      const frase = { pronto: 'está pronto', recusado: 'foi recusado', em_tratamento: 'está a ser tratado' }[r.estado]
      await this.notificacoes?.notificar([p.estudanteId], { tipo: 'pedido', titulo: `O seu pedido "${p.tipo}" ${frase}`, texto: r.resposta || '', ligacao: '/pedidos' })
    }
    return r
  }

  async ficheiro(ctx, id) {
    ctx.actor.exigir('academico.ver')
    const f = await this.academico.ficheiro(id)
    if (!f) throw new NaoEncontrado('Ficheiro não encontrado.')
    return { caminho: this.privados.absoluto(f.caminho), nome: f.nome, tipo: f.tipo }
  }
}
