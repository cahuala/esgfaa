#!/usr/bin/env node
/*
  Prepara a pasta da aplicação do sistema de pessoal (dist-pessoal/) a partir do build (npm run build):
  a página dist/pessoal/index.html passa a index.html e vêm os recursos partilhados (dist/assets, o brasão…).
  Não leva as páginas do site, do portal nem do painel. A API interna serve esta pasta (APP_DIR).
*/
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(RAIZ, 'dist')
const saida = path.resolve(process.argv[2] || path.join(RAIZ, 'dist-pessoal'))
if (!fs.existsSync(path.join(dist, 'pessoal', 'index.html'))) {
  console.error('Falta dist/pessoal/index.html: corra primeiro «npm run build».')
  process.exit(1)
}
fs.rmSync(saida, { recursive: true, force: true })
fs.mkdirSync(saida, { recursive: true })
fs.copyFileSync(path.join(dist, 'pessoal', 'index.html'), path.join(saida, 'index.html'))
fs.cpSync(path.join(dist, 'assets'), path.join(saida, 'assets'), { recursive: true })
for (const f of fs.readdirSync(dist, { withFileTypes: true })) if (f.isFile() && f.name !== 'index.html' && f.name !== '404.html') fs.copyFileSync(path.join(dist, f.name), path.join(saida, f.name))
console.log(`Aplicação do pessoal pronta em ${path.relative(RAIZ, saida) || saida} (APP_DIR).`)
