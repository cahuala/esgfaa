import { ContaBloqueada, ErroValidacao } from '../comum/erros.js'
import { limparTexto } from '../comum/texto.js'
import { normalizarEmail } from './email.js'

export const MAX_TENTATIVAS = 5
export const MINUTOS_BLOQUEIO = 15

// Utilizador do painel. A palavra-passe guarda-se só cifrada (senha = hash).
export class Utilizador {
  constructor(props) {
    Object.assign(this, {
      id: null,
      ativo: true,
      tentativasFalhadas: 0,
      bloqueadoAte: null,
      versaoToken: 0,
      deveMudarSenha: false,
      ultimoAcesso: null,
      criadoEm: null,
      ...props,
    })
  }

  static novo({ nome, email, papel, senhaCifrada, deveMudarSenha = false }) {
    const u = new Utilizador({ papel, senha: senhaCifrada, deveMudarSenha })
    u.definirNome(nome)
    u.email = normalizarEmail(email)
    return u
  }

  definirNome(nome) {
    const n = limparTexto(nome)
    if (n.length < 2 || n.length > 100) throw new ErroValidacao('O nome deve ter entre 2 e 100 caracteres.')
    this.nome = n
  }

  bloqueado(agora) {
    return Boolean(this.bloqueadoAte && new Date(this.bloqueadoAte) > agora)
  }

  // falha de entrada: ao fim de MAX_TENTATIVAS seguidas, a conta fica bloqueada durante MINUTOS_BLOQUEIO
  registarFalha(agora) {
    this.tentativasFalhadas += 1
    if (this.tentativasFalhadas >= MAX_TENTATIVAS) {
      this.bloqueadoAte = new Date(agora.getTime() + MINUTOS_BLOQUEIO * 60_000).toISOString()
      this.tentativasFalhadas = 0
      return true
    }
    return false
  }

  garantirPodeEntrar(agora) {
    if (this.bloqueado(agora)) {
      throw new ContaBloqueada(`Conta bloqueada por excesso de tentativas. Tente de novo dentro de ${MINUTOS_BLOQUEIO} minutos.`, this.bloqueadoAte)
    }
  }

  registarEntrada(agora) {
    this.tentativasFalhadas = 0
    this.bloqueadoAte = null
    this.ultimoAcesso = agora.toISOString()
  }

  // termina todas as sessões abertas (tokens emitidos antes deixam de valer)
  invalidarSessoes() {
    this.versaoToken += 1
  }

  mudarSenha(senhaCifrada) {
    this.senha = senhaCifrada
    this.deveMudarSenha = false
    this.invalidarSessoes()
  }

  publico() {
    return {
      id: this.id,
      nome: this.nome,
      email: this.email,
      papel: this.papel,
      ativo: Boolean(this.ativo),
      criadoEm: this.criadoEm,
      ultimoAcesso: this.ultimoAcesso,
    }
  }
}
