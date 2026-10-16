import fs from 'node:fs'
import path from 'node:path'
import webpush from 'web-push'

/*
  Avisos no telemóvel (Web Push, o padrão dos navegadores: Chrome, Edge, Firefox, Safari).
  As chaves VAPID vêm do ambiente ou, sem elas, criam-se na primeira vez e ficam na pasta
  de dados — a Escola não precisa de configurar nada nem de contratar nenhum serviço.
*/
function chavesVapid({ push, pastaDados }) {
  if (push?.publica && push?.privada) return { publicKey: push.publica, privateKey: push.privada }
  const ficheiro = pastaDados ? path.join(pastaDados, 'vapid.json') : null
  if (ficheiro && fs.existsSync(ficheiro)) return JSON.parse(fs.readFileSync(ficheiro, 'utf8'))
  const novas = webpush.generateVAPIDKeys()
  if (ficheiro) {
    fs.mkdirSync(pastaDados, { recursive: true })
    fs.writeFileSync(ficheiro, JSON.stringify(novas), { mode: 0o600 })
  }
  return novas
}

export function criarPush(config) {
  const chaves = chavesVapid(config)
  const assunto = config.push?.assunto || 'mailto:geral@esgfaa.gov.ao'
  return {
    chavePublica: chaves.publicKey,
    // 'ok' | 'expirada' (o aparelho deixou de aceitar: apaga-se a subscrição)
    async enviar(subscricao, carga) {
      try {
        await webpush.sendNotification(
          { endpoint: subscricao.endpoint, keys: { p256dh: subscricao.p256dh, auth: subscricao.auth } },
          JSON.stringify(carga),
          { TTL: 86_400, urgency: 'normal', vapidDetails: { subject: assunto, publicKey: chaves.publicKey, privateKey: chaves.privateKey } },
        )
        return 'ok'
      } catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410) return 'expirada'
        throw e
      }
    },
  }
}
