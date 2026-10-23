import crypto from 'node:crypto'

/*
  «Não sou um robô» sem serviços de fora (nada do Google nem de terceiros: funciona também na rede interna).
  O servidor dá um desafio assinado; o navegador procura o número n tal que SHA-256(sal + n) = desafio.
  Para uma pessoa custa menos de um segundo; para um robô que tenta milhares de senhas, cada tentativa
  custa trabalho, e quem já errou recebe desafios mais difíceis. Cada desafio vale 5 minutos e só uma vez.
*/
export const VALIDADE_MS = 5 * 60_000
export const DIFICULDADE = { normal: 60_000, suspeito: 400_000 }

const sha256 = (t) => crypto.createHash('sha256').update(t).digest('hex')
const assinar = (segredo, t) => crypto.createHmac('sha256', segredo).update(t).digest('hex')

export function criarDesafio(segredo, { maximo = DIFICULDADE.normal, agora = Date.now() } = {}) {
  const sal = `${agora + VALIDADE_MS}.${crypto.randomBytes(12).toString('hex')}.`
  const numero = crypto.randomInt(0, maximo + 1)
  const desafio = sha256(`${sal}${numero}`)
  return { algoritmo: 'SHA-256', sal, desafio, maximo, assinatura: assinar(segredo, `${sal}|${desafio}|${maximo}`) }
}

// desafios já usados (até expirarem): uma prova não serve duas vezes
export class ProvasUsadas {
  constructor() { this.l = new Map() }
  usar(chave, ate) {
    const agora = Date.now()
    if (this.l.size > 20_000) for (const [k, v] of this.l) if (v < agora) this.l.delete(k)
    if (this.l.has(chave)) return false
    this.l.set(chave, ate)
    return true
  }
}

// prova = { sal, desafio, maximo, assinatura, numero }: true se resolve um desafio nosso, válido e por usar
export function verificarProva(segredo, prova, usadas, agora = Date.now()) {
  if (!prova || typeof prova !== 'object') return false
  const { sal, desafio, maximo, assinatura, numero } = prova
  if (typeof sal !== 'string' || typeof desafio !== 'string' || typeof assinatura !== 'string' || !Number.isInteger(numero) || !Number.isInteger(maximo)) return false
  if (sal.length > 80 || desafio.length !== 64 || numero < 0 || numero > maximo) return false
  const esperada = Buffer.from(assinar(segredo, `${sal}|${desafio}|${maximo}`))
  const dada = Buffer.from(assinatura)
  if (esperada.length !== dada.length || !crypto.timingSafeEqual(esperada, dada)) return false
  const ate = Number(sal.split('.')[0])
  if (!(ate > agora)) return false
  if (sha256(`${sal}${numero}`) !== desafio) return false
  return usadas.usar(desafio, ate)
}

// para os testes e para quem chama a API por programa: resolve um desafio (força bruta, como o navegador)
export function resolverDesafio(d) {
  for (let n = 0; n <= d.maximo; n++) if (sha256(`${d.sal}${n}`) === d.desafio) return { ...d, numero: n }
  return null
}
