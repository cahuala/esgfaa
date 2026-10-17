import crypto from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(crypto.scrypt)
const COMPRIMENTO = 64

/*
  Palavras-passe com scrypt (formato "scrypt$sal$hash", compatível com as contas já criadas).
  Corre fora da thread principal para não bloquear outros pedidos.
*/
export class CifraSenhas {
  // hash usado quando o e-mail não existe: a resposta demora o mesmo e não revela que contas há
  #ficticio = null

  async cifrar(senha) {
    const sal = crypto.randomBytes(16)
    const hash = await scrypt(String(senha), sal, COMPRIMENTO)
    return `scrypt$${sal.toString('hex')}$${hash.toString('hex')}`
  }

  async verificar(senha, guardada) {
    const [esquema, salHex, hashHex] = String(guardada || '').split('$')
    if (esquema !== 'scrypt' || !salHex || !hashHex) return false
    const esperado = Buffer.from(hashHex, 'hex')
    const calculado = await scrypt(String(senha), Buffer.from(salHex, 'hex'), esperado.length)
    return crypto.timingSafeEqual(esperado, calculado)
  }

  async verificarFicticio(senha) {
    this.#ficticio ??= await this.cifrar(crypto.randomUUID())
    await this.verificar(senha, this.#ficticio)
    return false
  }
}
