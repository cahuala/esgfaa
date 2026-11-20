import { criarConfig } from './config.js'
import { criarContentor } from './contentor.js'
import { criarApp } from './http/app.js'
import { cifrarExistentes } from './infraestrutura/cifraDados.js'

const config = criarConfig()
const contentor = criarContentor(config)
// fichas de antes da encriptação: cifram-se no arranque (só o que ainda está em texto)
const cifradas = await cifrarExistentes(contentor.base, contentor.cifraDados)
if (cifradas) console.log(`Dados pessoais cifrados em ${cifradas} ficha(s).`)
// os nomes mudados em Listas do sistema (postos, situações…) valem logo, também nos documentos
await contentor.servicos.listas.todas()
const admin = await contentor.servicos.sessao.garantirAdministrador(config.admin)
if (admin) console.log(`Administrador criado: ${admin.email}`)

const app = criarApp(contentor)
const servidor = app.listen(config.porta, config.host, () => console.log(`Sistema de Gestão de Pessoal em http://${config.host}:${config.porta} (só rede interna: ${config.redesInternas.join(', ')})`))

// prazos de conservação (Lei n.º 22/11): uma vez por dia, e no arranque
const limpar = () => contentor.servicos.privacidade.aplicarConservacao().catch((e) => console.error('Conservação:', e.message))
limpar()
setInterval(limpar, 24 * 3_600_000).unref()

// a conta do Comandante segue o quadro orgânico (quem ocupa o cargo): no arranque e de minuto a minuto
// e os civis da Repartição de Pessoal e Quadros têm conta (entram com o BI)
const contaComandante = () => contentor.servicos.sessao.garantirContaDoComandante().then((r) => {
  if (['criada', 'promovida'].includes(r.estado) || r.saidas) console.log('Conta do Comandante:', JSON.stringify(r))
}).catch((e) => console.error('Conta do Comandante:', e.message))
  .then(() => contentor.servicos.sessao.garantirContasCivis()).then((r) => { if (r?.criadas) console.log(`Contas de civis criadas: ${r.criadas}`) })
  .catch((e) => console.error('Contas dos civis:', e.message))
await contaComandante()
const intervaloComandante = setInterval(contaComandante, 60_000)

// as guias de férias do mês ficam prontas quando o mês chega (no arranque e de hora a hora)
const guiasFerias = () => contentor.servicos.planoFerias.prepararDoMesAtual().then((r) => {
  if (r.preparadas) console.log(`Guias de férias preparadas: ${r.preparadas}`)
  if (r.erros.length) console.error('Guias de férias:', r.erros.join('; '))
}).catch((e) => console.error('Guias de férias:', e.message))
await guiasFerias()
const intervaloGuias = setInterval(guiasFerias, 3_600_000)

// envio para o portal de minuto a minuto
const sinc = contentor.servicos.sincronizacao
const intervalo = sinc.ativa ? setInterval(() => sinc.enviarPendentes().catch((e) => console.error('Envio para o portal:', e.message)), 60_000) : null

async function parar() {
  clearInterval(intervalo)
  clearInterval(intervaloComandante)
  clearInterval(intervaloGuias)
  servidor.close()
  await contentor.fechar()
  process.exit(0)
}
process.on('SIGINT', parar)
process.on('SIGTERM', parar)
