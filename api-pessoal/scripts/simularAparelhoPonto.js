/*
  Simula um aparelho de ponto (impressão digital, protocolo «push» ZKTeco) para experimentar o livro de ponto
  sem o aparelho verdadeiro. Faz o que o aparelho faz: apresenta-se, vai buscar as ordens, responde e envia
  marcações.
    npm run simular-ponto                          apresenta-se (fica «por aprovar» no Pessoal)
    npm run simular-ponto -- --marcar 12           marca o ponto da ficha n.º 12, agora (com a «digital»)
    npm run simular-ponto -- --marcar 12 --hora "2026-10-20 07:58:00"
    npm run simular-ponto -- --digital 12          diz ao Pessoal que a ficha 12 registou uma digital
  --servidor (por omissão http://localhost:3002) e --sn (por omissão SIMULADOR001) mudam o aparelho.
*/
const args = process.argv.slice(2)
const opcao = (nome, padrao) => { const i = args.indexOf(`--${nome}`); return i >= 0 ? args[i + 1] : padrao }
const servidor = opcao('servidor', 'http://localhost:3002').replace(/\/$/, '')
const sn = opcao('sn', 'SIMULADOR001')
const agoraLuanda = () => new Date(Date.now() + 3_600_000).toISOString().slice(0, 19).replace('T', ' ')

async function pedir(caminho, corpo) {
  const r = await fetch(`${servidor}/iclock/${caminho}${caminho.includes('?') ? '&' : '?'}SN=${encodeURIComponent(sn)}`, corpo === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: corpo })
  return { estado: r.status, texto: await r.text() }
}

const ola = await pedir('cdata?options=all&pushver=2.4.1&DeviceType=Simulador')
console.log(`Apresentação (${ola.estado}):\n${ola.texto}\n`)

const ordens = await pedir('getrequest')
if (ordens.texto !== 'OK') {
  const l = ordens.texto.split('\n')
  console.log(`Recebidas ${l.length} ordem(ns), p.ex.: ${l[0].replace(/\t/g, ' ')}`)
  await pedir('devicecmd', l.map((x) => `ID=${x.split(':')[1]}&Return=0&CMD=${x.split(':')[2].split(' ')[0]}`).join('\n'))
} else console.log('Sem ordens (aparelho por aprovar, ou nada a fazer).')

const pin = opcao('marcar')
if (pin) {
  const r = await pedir('cdata?table=ATTLOG', `${pin}\t${opcao('hora', agoraLuanda())}\t0\t1\t0\t0\t0`)
  console.log(r.estado === 200 ? `Marcação da ficha ${pin} enviada (${r.texto}).` : `Recusada (${r.estado}): ${r.texto}`)
}
const digital = opcao('digital')
if (digital) {
  const r = await pedir('cdata?table=OPERLOG', `FP PIN=${digital}\tFID=0\tSize=0\tValid=1\tTMP=`)
  console.log(r.estado === 200 ? `Digital da ficha ${digital} registada.` : `Recusada (${r.estado}): ${r.texto}`)
}
