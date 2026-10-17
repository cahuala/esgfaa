import { conflito, invalido, naoEncontrado } from '../erros.js'
import { gerarCodigosRecuperacao, gerarSegredo, resumoCodigo, urlOtpauth, verificarCodigo } from '../dominio/totp.js'
import { exigir } from './sessao.js'

const EMISSOR = 'ESG — Pessoal'

/*
  Verificação em dois passos (TOTP, aplicação de autenticação do telemóvel) das contas do sistema de pessoal.
  Os papéis de DOIS_FATORES_PAPEIS (em produção, todos os que vêem fichas) só usam o sistema com ela ligada.
  O segredo fica cifrado na base de dados; dos códigos de recuperação só se guarda o resumo.
*/
export class ServicoDoisFatores {
  constructor({ bd, auditoria, agora = () => new Date(), papeis = [] }) {
    Object.assign(this, { bd, auditoria, agora, papeis })
  }

  obrigatorio(papel) {
    return this.papeis.includes(papel)
  }

  #registo(utilizadorId) {
    return this.bd.doisFatores.findUnique({ where: { utilizadorId } })
  }

  async ativo(utilizadorId) {
    return Boolean((await this.#registo(utilizadorId))?.ativo)
  }

  async estado(u) {
    const r = await this.#registo(u.id)
    return { ativo: Boolean(r?.ativo), obrigatorio: this.obrigatorio(u.papel), ativadoEm: r?.ativo ? r.ativadoEm : null, codigosRestantes: r?.ativo ? r.recuperacao.length : 0 }
  }

  async iniciar(u) {
    if ((await this.#registo(u.id))?.ativo) throw conflito('A verificação em dois passos já está ligada.')
    const segredo = gerarSegredo()
    await this.bd.doisFatores.upsert({ where: { utilizadorId: u.id }, create: { utilizadorId: u.id, segredo }, update: { segredo, ultimoContador: -1 } })
    return { segredo, url: urlOtpauth({ segredo, conta: u.email, emissor: EMISSOR }) }
  }

  async confirmar(u, { codigo }) {
    const r = await this.#registo(u.id)
    if (!r) throw invalido('Comece por «Ligar a verificação em dois passos».')
    if (r.ativo) throw conflito('A verificação em dois passos já está ligada.')
    const k = verificarCodigo(r.segredo, codigo, this.agora(), { ultimo: r.ultimoContador })
    if (k === null) throw invalido('Código errado. Confira a hora do telemóvel e use o código que aparece agora.', 'codigo')
    const codigos = gerarCodigosRecuperacao()
    await this.bd.doisFatores.update({ where: { id: r.id }, data: { ativo: true, ativadoEm: this.agora(), ultimoContador: k, recuperacao: codigos.map(resumoCodigo) } })
    await this.auditoria.registar(u, 'ligar_2fa')
    return { ativo: true, codigos }
  }

  async novosCodigos(u, { codigo }) {
    const r = await this.#registo(u.id)
    if (!r?.ativo) throw invalido('A verificação em dois passos não está ligada.')
    await this.#exigirCodigo(r, codigo)
    const codigos = gerarCodigosRecuperacao()
    await this.bd.doisFatores.update({ where: { id: r.id }, data: { recuperacao: codigos.map(resumoCodigo) } })
    await this.auditoria.registar(u, 'novos_codigos_2fa')
    return { codigos }
  }

  async desligar(u, { senha, codigo }, verificarSenha) {
    if (this.obrigatorio(u.papel)) throw invalido('O seu papel exige a verificação em dois passos: não pode ser desligada.')
    const r = await this.#registo(u.id)
    if (!r?.ativo) throw invalido('A verificação em dois passos não está ligada.')
    if (!(await verificarSenha(senha))) throw invalido('A palavra-passe está errada.', 'senha')
    await this.#exigirCodigo(r, codigo)
    await this.bd.doisFatores.delete({ where: { id: r.id } })
    await this.auditoria.registar(u, 'desligar_2fa')
    return { ativo: false }
  }

  async repor(u, utilizadorId) {
    exigir(u, 'administrar')
    const r = await this.#registo(utilizadorId)
    if (!r) throw naoEncontrado('Essa conta não tem a verificação em dois passos ligada.')
    await this.bd.doisFatores.delete({ where: { id: r.id } })
    await this.auditoria.registar(u, 'repor_2fa', `utilizador #${utilizadorId}`)
    return { ativo: false }
  }

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
    const k = verificarCodigo(r.segredo, c, this.agora(), { ultimo: r.ultimoContador })
    if (k !== null && (await this.bd.doisFatores.updateMany({ where: { id: r.id, ultimoContador: { lt: k } }, data: { ultimoContador: k } })).count) return
    const resumo = resumoCodigo(c)
    if (c.length >= 10 && r.recuperacao.includes(resumo)) {
      await this.bd.doisFatores.update({ where: { id: r.id }, data: { recuperacao: r.recuperacao.filter((x) => x !== resumo) } })
      return
    }
    throw invalido('Código errado.', 'codigo')
  }
}
