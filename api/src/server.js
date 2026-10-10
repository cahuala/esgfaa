import { criarConfig } from './infraestrutura/config.js'
import { criarContentor } from './contentor.js'
import { criarApp } from './interfaces/http/app.js'
import { prepararSistema } from './aplicacao/arranque.js'
import { semear } from '../scripts/semear.js'

const config = criarConfig()
if (config.segredoDesenvolvimento) console.warn('[aviso] JWT_SECRET não definido — a usar um segredo de desenvolvimento.')
if (config.producao && !config.urlPublico) console.warn('[aviso] PUBLIC_URL não definido — os endereços das imagens usam o cabeçalho Host do pedido.')

const contentor = criarContentor(config)

// 1.º arranque: carrega os conteúdos atuais do site para a base de dados
if (contentor.repositorios.conteudos.contarTodos() === 0) await semear(contentor)

const { administradorCriado: admin } = await prepararSistema(contentor)
if (admin) {
  console.log(`\nAdministrador inicial criado: ${admin.email}`)
  if (admin.gerada) console.log(`Palavra-passe gerada (mostrada só agora): ${admin.senha}\nTerá de a mudar ao entrar.\n`)
}

const app = criarApp(contentor)
const servidor = app.listen(config.porta, () => {
  console.log(`API ESGFAA a correr em http://localhost:${config.porta}`)
})
servidor.headersTimeout = 30_000
servidor.requestTimeout = 10 * 60_000 // envios de vídeos grandes

// desligar com cuidado: termina os pedidos em curso e fecha a base de dados
let aDesligar = false
function desligar(sinal) {
  if (aDesligar) return
  aDesligar = true
  console.log(`\n${sinal} recebido — a desligar…`)
  servidor.close(() => {
    contentor.fechar()
    process.exit(0)
  })
  setTimeout(() => process.exit(1), 10_000).unref()
}
process.on('SIGTERM', () => desligar('SIGTERM'))
process.on('SIGINT', () => desligar('SIGINT'))
