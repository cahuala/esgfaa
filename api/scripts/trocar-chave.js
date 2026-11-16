/*
  Troca a chave que cifra os dados pessoais na base de dados do portal (DADOS_CHAVE).
    DADOS_CHAVE_ANTIGA=<chave de antes> DADOS_CHAVE=<chave nova> node scripts/trocar-chave.js
  Decifra cada valor com a chave antiga e volta a cifrá-lo com a nova, tudo numa só transacção (se falhar, nada muda).
  O que já estiver com a chave nova fica como está (pode correr-se duas vezes). Sem DADOS_CHAVE_ANTIGA usa-se a
  chave de desenvolvimento (a dos dados de demonstração). Depois o portal arranca com a chave nova no DADOS_CHAVE.
*/
import crypto from 'node:crypto'
import { criarConfig } from '../src/infraestrutura/config.js'
import { criarPrisma } from '../src/infraestrutura/bd/prisma.js'
import { CifraDados, CIFRADOS } from '../src/infraestrutura/bd/cifraDados.js'

export async function trocarChave(prisma, antiga, nova) {
  const de = new CifraDados(antiga)
  const para = new CifraDados(nova)
  const recifrar = (v) => {
    try { para.decifrar(v); return null } catch { /* não é da chave nova: é da antiga */ }
    return para.cifrar(de.decifrar(v))
  }
  return prisma.$transaction(async (tx) => {
    let n = 0
    for (const [modelo, def] of Object.entries(CIFRADOS)) {
      const campos = [...(def.texto ?? []), ...(def.json ?? [])]
      const linhas = await tx[modelo].findMany({ select: { id: true, ...Object.fromEntries(campos.map((c) => [c, true])) } })
      for (const l of linhas) {
        const d = {}
        for (const c of def.texto ?? []) if (CifraDados.cifrado(l[c])) { const v = recifrar(l[c]); if (v) d[c] = v }
        for (const c of def.json ?? []) if (CifraDados.cifrado(l[c]) && typeof l[c] === 'object') { const v = recifrar(l[c].c1); if (v) d[c] = { c1: v } }
        if (Object.keys(d).length) { await tx[modelo].update({ where: { id: l.id }, data: d }); n++ }
      }
    }
    return n
  }, { maxWait: 15_000, timeout: 600_000 })
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const config = criarConfig()
  const antiga = process.env.DADOS_CHAVE_ANTIGA || crypto.createHash('sha256').update('portal-desenvolvimento-dados').digest('hex')
  if (antiga === config.chaveDados) { console.error('A chave nova (DADOS_CHAVE) é igual à antiga: nada a fazer.'); process.exit(1) }
  const prisma = criarPrisma(config.urlBaseDados)
  try {
    console.log(`${await trocarChave(prisma, antiga, config.chaveDados)} registos passaram para a chave nova.`)
  } finally { await prisma.$disconnect() }
}
