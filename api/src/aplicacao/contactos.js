import { ErroValidacao, NaoEncontrado } from '../dominio/comum/erros.js'
import { ESTADOS_CONTACTO, novaMensagemContacto } from '../dominio/interacao/mensagemContacto.js'

/*
  Formulário de contacto do site: a mensagem fica guardada e aparece no painel ("Mensagens do site");
  com CONTACTOS_EMAIL e SMTP configurados, também chega por e-mail.
*/
export class ServicoContactos {
  constructor({ contactos, correio, emailDestino = '', auditoria, registar }) {
    Object.assign(this, { contactos, correio, emailDestino, auditoria, registar })
  }

  async enviar(dados) {
    const m = await this.contactos.criar(novaMensagemContacto(dados))
    if (this.emailDestino && this.correio?.real) {
      await this.correio.enviar({
        para: this.emailDestino,
        assunto: `[Site ESG] ${m.assunto}`,
        texto: `Mensagem de ${m.nome} <${m.email}>${m.telefone ? ` · ${m.telefone}` : ''}\n\n${m.mensagem}\n\n— Enviada pelo formulário de contacto do site. Responda diretamente para ${m.email}.`,
      }).catch((e) => this.registar?.({ nivel: 'erro', mensagem: 'Contacto: e-mail', erro: e.message }))
    }
    return { ok: true }
  }

  async listar(ctx) {
    ctx.actor.exigir('contactos.ver')
    return { estados: ESTADOS_CONTACTO, mensagens: await this.contactos.listar() }
  }

  contarNovas(ctx) {
    return ctx.actor.pode('contactos.ver') ? this.contactos.contarNovas() : 0
  }

  async #mensagem(id) {
    const m = await this.contactos.ler(id)
    if (!m) throw new NaoEncontrado('Mensagem não encontrada.')
    return m
  }

  // abrir uma mensagem nova marca-a como lida
  async abrir(ctx, id) {
    ctx.actor.exigir('contactos.ver')
    const m = await this.#mensagem(id)
    if (m.estado === 'nova' && ctx.actor.pode('contactos.gerir')) return this.contactos.atualizar(id, { estado: 'lida', tratadoPor: ctx.actor.nome || '' })
    return m
  }

  async atualizar(ctx, id, { estado, notas }) {
    ctx.actor.exigir('contactos.gerir')
    await this.#mensagem(id)
    const dados = { tratadoPor: ctx.actor.nome || '' }
    if (estado !== undefined) {
      if (!(estado in ESTADOS_CONTACTO)) throw new ErroValidacao('Estado desconhecido.')
      dados.estado = estado
    }
    if (notas !== undefined) dados.notas = String(notas).slice(0, 3000)
    return this.contactos.atualizar(id, dados)
  }

  async apagar(ctx, id) {
    ctx.actor.exigir('contactos.gerir')
    const m = await this.#mensagem(id)
    await this.contactos.apagar(id)
    await this.auditoria.registar(ctx, { acao: 'apagar_contacto', colecao: 'contactos', alvoId: String(id), alvoTitulo: `Mensagem de ${m.nome}`, detalhes: { assunto: m.assunto } })
  }
}
