import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

/*
  Chave RSA com que o portal assina os lançamentos LTI 1.3 (id_token). Cria-se na primeira vez e fica em
  <pasta de dados>/lti.json, como as chaves dos avisos no telemóvel; a parte pública é publicada em
  /api/lti/jwks para as ferramentas verificarem a assinatura. Mudar de chave obriga a reconfigurar as ferramentas.
*/
export function chavesLti(pastaDados) {
  const ficheiro = pastaDados ? path.join(pastaDados, 'lti.json') : null
  let guardadas = null
  try { if (ficheiro && fs.existsSync(ficheiro)) guardadas = JSON.parse(fs.readFileSync(ficheiro, 'utf8')) } catch { guardadas = null }
  if (!guardadas?.privada) {
    const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
    guardadas = { kid: crypto.randomBytes(8).toString('hex'), privada: privateKey.export({ type: 'pkcs8', format: 'pem' }) }
    if (ficheiro) {
      fs.mkdirSync(pastaDados, { recursive: true })
      fs.writeFileSync(ficheiro, JSON.stringify(guardadas), { mode: 0o600 })
    }
  }
  const privada = crypto.createPrivateKey(guardadas.privada)
  const jwk = { ...crypto.createPublicKey(privada).export({ format: 'jwk' }), kid: guardadas.kid, alg: 'RS256', use: 'sig' }
  return { kid: guardadas.kid, privada, jwk }
}
