#!/usr/bin/env node
/*
  Servidor de testes: palavras-passe novas para as contas de demonstração (as de desenvolvimento são
  conhecidas e não servem num servidor na internet). As contas para os testadores recebem uma palavra-passe
  forte, escrita em CONTAS-SERVIDOR-TESTE.md (fora do repositório); todas as outras, uma aleatória que
  ninguém conhece. Também se tiram as verificações em dois passos ligadas em desenvolvimento.
    node deploy/teste-contas.mjs portal  > portal.sql    (painel e Portal Académico)
    node deploy/teste-contas.mjs pessoal > pessoal.sql   (Sistema de Pessoal)
  O SQL só leva os resumos (scrypt), nunca as palavras-passe.
*/
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ficheiro = path.join(raiz, 'CONTAS-SERVIDOR-TESTE.md')

// as contas que se entregam aos testadores (as outras ficam com uma palavra-passe que ninguém sabe)
const CONTAS = {
  portal: {
    utilizadores: ['admin', 'chefe', 'redatora', 'moderador', 'analista', 'pessoal', 'escolar', 'biblioteca', 'director', 'comandante', 'ciberseguranca'].map((n) => `${n}@esgfaa.gov.ao`),
    contas_portal: ['miguel.santos', 'ana.baptista', 'pedro.neto', 'joao.fernandes', 'maria.costa', 'sofia.lima'].map((n) => `${n}@esgfaa.gov.ao`),
  },
  pessoal: { utilizadores: ['pessoal@esgfaa.gov.ao', '100001@pessoal.interno'] },
}

// fácil de ditar e de escrever: 4 grupos de letras e algarismos sem 0/O, 1/l
const LETRAS = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const senhaNova = () => Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => LETRAS[crypto.randomInt(LETRAS.length)]).join('')).join('-')
const resumo = (s) => { const sal = crypto.randomBytes(16); return `scrypt$${sal.toString('hex')}$${crypto.scryptSync(s, sal, 64).toString('hex')}` }
const q = (s) => `'${String(s).replace(/'/g, "''")}'`

const sistema = process.argv[2]
if (!CONTAS[sistema]) { console.error('Uso: node deploy/teste-contas.mjs portal|pessoal'); process.exit(1) }

const sql = ['BEGIN;']
const entregues = []
for (const [tabela, emails] of Object.entries(CONTAS[sistema])) {
  const [deveMudar, falhas] = sistema === 'pessoal' ? ['deve_mudar', 'falhas'] : ['deve_mudar_senha', 'tentativas_falhadas']
  // todas as contas: uma palavra-passe aleatória (ninguém entra com as de desenvolvimento)
  sql.push(`UPDATE ${tabela} SET senha = ${q(resumo(crypto.randomUUID()))};`)
  for (const email of emails) {
    const senha = senhaNova()
    entregues.push([sistema === 'pessoal' ? 'Sistema de Pessoal' : tabela === 'contas_portal' ? 'Portal Académico' : 'Painel de gestão', email, senha])
    sql.push(`UPDATE ${tabela} SET senha = ${q(resumo(senha))}, ${deveMudar} = false, ${falhas} = 0, bloqueado_ate = NULL WHERE lower(email) = ${q(email)};`)
  }
}
sql.push('DELETE FROM dois_fatores;')
sql.push('COMMIT;')

const titulo = sistema === 'pessoal' ? 'Sistema de Pessoal' : 'Painel de gestão e Portal Académico'
const antes = fs.existsSync(ficheiro) ? fs.readFileSync(ficheiro, 'utf8').replace(new RegExp(`\\n## ${titulo}[\\s\\S]*?(?=\\n## |$)`), '') : '# Contas do servidor de testes\n\nNão pôr no repositório. Entregar a cada testador só a conta de que precisa.\n'
fs.writeFileSync(ficheiro, `${antes.trimEnd()}\n\n## ${titulo}\n\n| Sistema | E-mail | Palavra-passe |\n|---|---|---|\n${entregues.map((l) => `| ${l.join(' | ')} |`).join('\n')}\n`, { mode: 0o600 })
process.stdout.write(sql.join('\n') + '\n')
