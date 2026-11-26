import net from 'node:net'

/*
  O painel de gestão (Administração Escolar, Comandante, conteúdos do site) fica na rede interna da Escola: com
  PAINEL_REDES («10.0.0.0/8,192.168.1.0/24»…), só abre a partir dessas redes. Fora delas responde 403. Sem redes
  configuradas abre de qualquer lado (o servidor de teste). O site público, o Portal Académico (estudantes e
  docentes, em casa) e a ligação do Pessoal não passam por aqui.
*/
export function soRedeInterna(redes = []) {
  if (!redes.length) return (req, res, next) => next()
  const lista = new net.BlockList()
  for (const r of redes) {
    const [ip, bits] = r.split('/')
    const tipo = net.isIPv6(ip) ? 'ipv6' : 'ipv4'
    if (bits) lista.addSubnet(ip, Number(bits), tipo)
    else lista.addAddress(ip, tipo)
  }
  return (req, res, next) => {
    const ip = String(req.ip ?? '').replace(/^::ffff:/, '')
    const tipo = net.isIPv6(ip) ? 'ipv6' : 'ipv4'
    if (net.isIP(ip) && lista.check(ip, tipo)) return next()
    return res.status(403).json({ erro: 'O painel de gestão só abre na rede interna da Escola.', codigo: 'fora_da_rede' })
  }
}
