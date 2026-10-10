import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'

const EMISSOR = 'esgfaa-api'
const AUDIENCIA = 'esgfaa-painel'
const ALGORITMO = 'HS256'

/*
  Sessões do painel (JWT assinado). Cada token leva:
  sub = utilizador, ver = versão da conta (mudar senha/papel/desativar invalida os anteriores),
  jti = identificador único (permite terminar uma sessão concreta ao sair).
*/
export class Tokens {
  constructor({ segredo, duracao }) {
    this.segredo = segredo
    this.duracao = duracao
  }

  emitir(utilizador) {
    return jwt.sign({ ver: utilizador.versaoToken }, this.segredo, {
      algorithm: ALGORITMO,
      expiresIn: this.duracao,
      issuer: EMISSOR,
      audience: AUDIENCIA,
      subject: String(utilizador.id),
      jwtid: crypto.randomUUID(),
    })
  }

  // devolve { utilizadorId, versao, jti, expira } ou null se o token for inválido/expirado
  verificar(token) {
    try {
      const p = jwt.verify(token, this.segredo, { algorithms: [ALGORITMO], issuer: EMISSOR, audience: AUDIENCIA })
      if (!p.sub || !p.jti || typeof p.ver !== 'number') return null
      return { utilizadorId: Number(p.sub), versao: p.ver, jti: p.jti, expira: new Date(p.exp * 1000).toISOString() }
    } catch {
      return null
    }
  }
}
