import { criarConfig } from './config.js'
import { criarContentor } from './contentor.js'
import { criarApp } from './http/app.js'
import { cifrarExistentes } from './infraestrutura/cifraDados.js'

const config = criarConfig()
const contentor = criarContentor(config)
// fichas de antes da encriptação: cifram-se no arranque (só o que ainda está em texto)
const cifradas = await cifrarExistentes(contentor.base, contentor.cifraDados)
if (cifradas) console.log(`Dados pessoais cifrados em ${cifradas} ficha(s).`)
const admin = await contentor.servicos.sessao.garantirAdministrador(config.admin)
if (admin) console.log(`Administrador criado: ${admin.email}`)

const app = criarApp(contentor)
const servidor = app.listen(config.porta, config.host, () => console.log(`Sistema de Gestão de Pessoal em http://${config.host}:${config.porta} (só rede interna: ${config.redesInternas.join(', ')})`))

// prazos de conservação (Lei n.º 22/11): uma vez por dia, e no arranque
const limpar = () => contentor.servicos.privacidade.aplicarConservacao().catch((e) => console.error('Conservação:', e.message))
limpar()
setInterval(limpar, 24 * 3_600_000).unref()

// envio para o portal de minuto a minuto
const sinc = contentor.servicos.sincronizacao
const intervalo = sinc.ativa ? setInterval(() => sinc.enviarPendentes().catch((e) => console.error('Envio para o portal:', e.message)), 60_000) : null

async function parar() {
  clearInterval(intervalo)
  servidor.close()
  await contentor.fechar()
  process.exit(0)
}
process.on('SIGINT', parar)
process.on('SIGTERM', parar)
