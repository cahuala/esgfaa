import { Conflito, ErroValidacao, NaoEncontrado } from '../dominio/comum/erros.js'
import { gerarCodigosRecuperacao, gerarSegredo, resumoCodigo, urlOtpauth, verificarCodigo } from '../dominio/identidade/totp.js'

const EMISSOR = 'ESG — Painel'

/*
  Verificação em dois passos das contas do painel: além da palavra-passe, um código de 6 algarismos da
  aplicação de autenticação do telemóvel (ou um código de recuperação, uma só vez). Os papéis de
  DOIS_FATORES_PAPEIS (em produção, o administrador) não usam o painel sem a ligar.
*/
export class ServicoDoisFatores {
  constructor({ prisma, cifra, auditoria, relogio, papeis = [] }) {
    Object.assign(this, { prisma, cifra, auditoria, relogio, papeis })
  }

  obrigatorio(papel) {
    return this.papeis.includes(papel)
  }

  #registo(utilizadorId) {
    return this.prisma.doisFatores.findUnique({ where: { utilizadorId } })
  }

  async ativo(utilizadorId) {
    return Boolean((await this.#registo(utilizadorId))?.ativo)
  }

  async estado(ctx) {
    const r = await this.#registo(ctx.actor.id)
    return { ativo: Boolean(r?.ativo), obrigatorio: this.obrigatorio(ctx.actor.papel), ativadoEm: r?.ativo ? r.ativadoEm : null, codigosRestantes: r?.ativo ? r.recuperacao.length : 0 }
  }

  // 1.º passo: segredo novo (ainda não vale) e o endereço para o QR code
  async iniciar(ctx) {
    const r = await this.#registo(ctx.actor.id)
    if (r?.ativo) throw new Conflito('A verificação em dois passos já está ligada.')
    const segredo = gerarSegredo()
    await this.prisma.doisFatores.upsert({ where: { utilizadorId: ctx.actor.id }, create: { utilizadorId: ctx.actor.id, segredo }, update: { segredo, ultimoContador: -1 } })
    return { segredo, url: urlOtpauth({ segredo, conta: ctx.actor.email, emissor: EMISSOR }) }
  }

  // 2.º passo: o primeiro código certo liga-a; devolve os códigos de recuperação (mostram-se só agora)
  async confirmar(ctx, { codigo }) {
    const r = await this.#registo(ctx.actor.id)
    if (!r) throw new ErroValidacao('Comece por «Ligar a verificação em dois passos».')
    if (r.ativo) throw new Conflito('A verificação em dois passos já está ligada.')
    const k = verificarCodigo(r.segredo, codigo, this.relogio.agora(), { ultimo: r.ultimoContador })
    if (k === null) throw new ErroValidacao('Código errado. Confira a hora do telemóvel e use o código que aparece agora.', { campo: 'codigo' })
    const codigos = gerarCodigosRecuperacao()
    await this.prisma.doisFatores.update({ where: { id: r.id }, data: { ativo: true, ativadoEm: this.relogio.agora(), ultimoContador: k, recuperacao: codigos.map(resumoCodigo) } })
    await this.auditoria.registar(ctx, { acao: 'ligar_2fa' })
    return { ativo: true, codigos }
  }

  async novosCodigos(ctx, { codigo }) {
    const r = await this.#registo(ctx.actor.id)
    if (!r?.ativo) throw new ErroValidacao('A verificação em dois passos não está ligada.')
    await this.#exigirCodigo(r, codigo)
    const codigos = gerarCodigosRecuperacao()
    await this.prisma.doisFatores.update({ where: { id: r.id }, data: { recuperacao: codigos.map(resumoCodigo) } })
    await this.auditoria.registar(ctx, { acao: 'novos_codigos_2fa' })
    return { codigos }
  }

  // desligar pede a palavra-passe e um código (quem roubar a sessão não a desliga)
  async desligar(ctx, { senha, codigo }, verificarSenha) {
    if (this.obrigatorio(ctx.actor.papel)) throw new ErroValidacao('O seu papel exige a verificação em dois passos: não pode ser desligada.')
    const r = await this.#registo(ctx.actor.id)
    if (!r?.ativo) throw new ErroValidacao('A verificação em dois passos não está ligada.')
    if (!(await verificarSenha(senha))) throw new ErroValidacao('A palavra-passe está errada.', { campo: 'senha' })
    await this.#exigirCodigo(r, codigo)
    await this.prisma.doisFatores.delete({ where: { id: r.id } })
    await this.auditoria.registar(ctx, { acao: 'desligar_2fa' })
    return { ativo: false }
  }

  // quem perdeu o telemóvel e os códigos: um administrador repõe (a pessoa volta a ligá-la ao entrar)
  async repor(ctx, utilizadorId) {
    ctx.actor.exigir('utilizadores.editar')
    const id = Number(utilizadorId)
    const r = await this.#registo(id)
    if (!r) throw new NaoEncontrado('Essa conta não tem a verificação em dois passos ligada.')
    await this.prisma.doisFatores.delete({ where: { id: r.id } })
    await this.auditoria.registar(ctx, { acao: 'repor_2fa', colecao: 'utilizadores', alvoId: id })
    return { ativo: false }
  }

  // ao entrar: true se o código (ou um código de recuperação) for válido; gasta-o
  async verificarEntrada(utilizadorId, codigo) {
    const r = await this.#registo(utilizadorId)
    if (!r?.ativo) return true
    try {
      await this.#exigirCodigo(r, codigo)
      return true
    } catch {
      return false
    }
  }

  async #exigirCodigo(r, codigo) {
    const c = String(codigo ?? '').trim()
    const k = verificarCodigo(r.segredo, c, this.relogio.agora(), { ultimo: r.ultimoContador })
    if (k !== null) {
      // só avança: o mesmo código (ou um mais antigo) não volta a servir
      const n = await this.prisma.doisFatores.updateMany({ where: { id: r.id, ultimoContador: { lt: k } }, data: { ultimoContador: k } })
      if (n.count) return
    }
    const resumo = resumoCodigo(c)
    if (c.length >= 10 && r.recuperacao.includes(resumo)) {
      await this.prisma.doisFatores.update({ where: { id: r.id }, data: { recuperacao: r.recuperacao.filter((x) => x !== resumo) } })
      return
    }
    throw new ErroValidacao('Código errado.', { campo: 'codigo' })
  }
}
