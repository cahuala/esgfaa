import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'

const EMISSOR = 'esgfaa-pessoal'
const AUDIENCIA = 'esgfaa-pessoal'
const ALGORITMO = 'HS256'

// sessões (JWT): sub = utilizador, ver = versão da conta (mudar senha, papel ou desativar invalida os anteriores)
export class Tokens {
  constructor({ segredo, duracao }) {
    this.segredo = segredo
    this.duracao = duracao
  }

  emitir(u) {
    return jwt.sign({ ver: u.versaoToken }, this.segredo, { algorithm: ALGORITMO, expiresIn: this.duracao, issuer: EMISSOR, audience: AUDIENCIA, subject: String(u.id), jwtid: crypto.randomUUID() })
  }

  verificar(token) {
    try {
      const p = jwt.verify(token, this.segredo, { algorithms: [ALGORITMO], issuer: EMISSOR, audience: AUDIENCIA })
      return p.sub && typeof p.ver === 'number' ? { utilizadorId: Number(p.sub), versao: p.ver } : null
    } catch {
      return null
    }
  }
}
