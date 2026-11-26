#!/usr/bin/env node
/*
  Prepara o pendrive de instalação do PORTAL da Escola (servidor da Escola, Windows, sem internet):
  o site, o Portal Académico (estudantes e docentes), o painel de gestão (Administração Escolar, Comando,
  Direcção de Ensino e departamentos, Biblioteca, gestão do site) e a API com a base de dados.

    node instalador/preparar-portal.mjs [--destino <pasta ou pendrive>]

  1. Usa os mesmos componentes do pendrive do Pessoal (Node.js, PostgreSQL, Caddy, WinSW, Visual C++), em cache.
  2. Constrói as páginas com a API no mesmo endereço (o domínio escolhe-se na instalação); o sistema de
     pessoal não vai (tem o seu próprio pendrive); o painel fica em /painel/.
  3. Junta a API com as dependências de produção para Windows x64 (o sharp das imagens é nativo) e os
     conteúdos iniciais do site (src/data e src/assets), que entram na base no primeiro arranque.
  4. Escreve o MANIFESTO (o instalador confere cada ficheiro).
  Sem dados reais, sem chaves: as chaves criam-se na instalação, no servidor.
  Por omissão a pasta fica em instalador/pendrive/ESG-PORTAL (fora do git): copie-a para a raiz do pendrive.
*/
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { COMPONENTES } from './componentes.mjs'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const RAIZ = path.resolve(AQUI, '..')
const CACHE = path.join(AQUI, '.cache')
const arg = (n, padrao) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : padrao }
const DESTINO = path.resolve(arg('--destino', path.join(AQUI, 'pendrive')), 'ESG-PORTAL')
const passo = (t) => console.log(`\n» ${t}`)
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')
const correr = (cmd, args, opcoes = {}) => execFileSync(cmd, args, { stdio: 'inherit', ...opcoes })

// os componentes do Windows já descarregados (e conferidos) pelo preparar-pendrive.mjs
function componentes(pasta) {
  const falta = []
  for (const c of COMPONENTES.filter((x) => x.sistema === 'windows' || x.id === 'winsw')) {
    const f = path.join(CACHE, c.nomeFicheiro ?? path.basename(new URL(c.url).pathname))
    if (!fs.existsSync(f)) { falta.push(c.nome); continue }
    fs.copyFileSync(f, path.join(pasta, `${c.id}${f.endsWith('.exe') ? '.exe' : '.zip'}`))
    console.log(`  ✓ ${c.nome}`)
  }
  if (falta.length) throw new Error(`Faltam componentes em instalador/.cache (${falta.join(', ')}): corra primeiro  node instalador/preparar-pendrive.mjs --so-descarregar`)
}

// as páginas: site (raiz), portal (/portal/) e painel (/painel/); a API no mesmo endereço
function paginas(app) {
  passo('A construir as páginas (site, Portal Académico e painel)…')
  correr('npm', ['run', 'build'], { cwd: RAIZ, env: { ...process.env, VITE_API_URL: 'mesma-origem', VITE_AMBIENTE: '', VITE_PESSOAL_API: '' } })
  const dist = path.join(RAIZ, 'dist')
  fs.cpSync(dist, app, { recursive: true })
  // o sistema de pessoal não vai para este servidor
  fs.rmSync(path.join(app, 'pessoal'), { recursive: true, force: true })
  fs.renameSync(path.join(app, 'admin'), path.join(app, 'painel'))
}

// a API (com as migrações e os conteúdos iniciais do site) e as dependências para Windows x64
function api(sis) {
  passo('A juntar a API e as dependências de produção (Windows x64)…')
  const origem = path.join(RAIZ, 'api')
  const destino = path.join(sis, 'api')
  fs.mkdirSync(destino, { recursive: true })
  for (const f of ['package.json', 'package-lock.json', 'prisma.config.js']) fs.copyFileSync(path.join(origem, f), path.join(destino, f))
  fs.cpSync(path.join(origem, 'src'), path.join(destino, 'src'), { recursive: true })
  fs.cpSync(path.join(origem, 'prisma'), path.join(destino, 'prisma'), { recursive: true })
  fs.mkdirSync(path.join(destino, 'scripts'), { recursive: true })
  // só o que corre na Escola: migrações, conteúdos iniciais do site, troca de chave; nada de demonstração
  for (const f of ['migrar.js', 'semear.js', 'carregador-dados.js', 'nomes.js', 'trocar-chave.js']) fs.copyFileSync(path.join(origem, 'scripts', f), path.join(destino, 'scripts', f))
  // os conteúdos actuais do site (entram na base no 1.º arranque) e o package.json da raiz (módulos ES)
  fs.copyFileSync(path.join(RAIZ, 'package.json'), path.join(sis, 'package.json'))
  fs.mkdirSync(path.join(sis, 'src'), { recursive: true })
  fs.cpSync(path.join(RAIZ, 'src', 'data'), path.join(sis, 'src', 'data'), { recursive: true })
  fs.cpSync(path.join(RAIZ, 'src', 'assets'), path.join(sis, 'src', 'assets'), { recursive: true })
  fs.mkdirSync(path.join(sis, 'scripts'), { recursive: true })
  fs.copyFileSync(path.join(RAIZ, 'scripts', 'copias.mjs'), path.join(sis, 'scripts', 'copias.mjs'))
  // --os/--cpu: os binários nativos (sharp, canvas) do Windows, mesmo a preparar noutro sistema
  correr('npm', ['ci', '--omit=dev', '--no-audit', '--no-fund', '--os=win32', '--cpu=x64'], { cwd: destino })
  if (!fs.existsSync(path.join(destino, 'node_modules', '@img', 'sharp-win32-x64'))) throw new Error('Não ficou o sharp para Windows x64 (@img/sharp-win32-x64): actualize o npm (10+) e repita.')
  // o cliente do Prisma é JavaScript + WebAssembly; a linha de comandos e os motores desta máquina não vão
  for (const d of ['prisma', '@prisma/engines', '@prisma/studio-core', '@prisma/fetch-engine', '@prisma/get-platform', '@prisma/dev', '@electric-sql']) fs.rmSync(path.join(destino, 'node_modules', d), { recursive: true, force: true })
  fs.rmSync(path.join(destino, 'node_modules', '.bin'), { recursive: true, force: true })
  // os binários nativos de outros sistemas não fazem falta
  for (const base of ['@img', '@napi-rs']) {
    const p = path.join(destino, 'node_modules', base)
    if (!fs.existsSync(p)) continue
    for (const d of fs.readdirSync(p)) if (/(darwin|linux|freebsd|android)/.test(d)) fs.rmSync(path.join(p, d), { recursive: true, force: true })
  }
}

function manifesto(raiz) {
  const linhas = []
  const andar = (d) => {
    for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, f.name)
      if (f.isDirectory()) { if (f.name !== 'registos') andar(p) } else if (f.name !== 'MANIFESTO.txt') linhas.push(`${sha(p)}  ${path.relative(raiz, p).split(path.sep).join('/')}`)
    }
  }
  andar(raiz)
  fs.writeFileSync(path.join(raiz, 'MANIFESTO.txt'), `${linhas.sort((a, b) => a.slice(66).localeCompare(b.slice(66))).join('\n')}\n`)
}

async function main() {
  fs.rmSync(DESTINO, { recursive: true, force: true })
  const comp = path.join(DESTINO, 'componentes')
  const sis = path.join(DESTINO, 'sistema')
  for (const d of [comp, sis, path.join(DESTINO, 'registos')]) fs.mkdirSync(d, { recursive: true })
  passo('Os componentes (Node.js, PostgreSQL, Caddy, WinSW)…')
  componentes(comp)
  paginas(path.join(sis, 'app'))
  api(sis)

  passo('A copiar o instalador…')
  fs.mkdirSync(path.join(DESTINO, 'windows'), { recursive: true })
  fs.copyFileSync(path.join(AQUI, 'windows', 'instalar-portal.ps1'), path.join(DESTINO, 'windows', 'instalar-portal.ps1'))
  fs.copyFileSync(path.join(AQUI, 'INSTALAR-PORTAL-WINDOWS.bat'), path.join(DESTINO, 'INSTALAR-PORTAL-WINDOWS.bat'))
  fs.copyFileSync(path.join(AQUI, 'LEIA-ME-PORTAL.txt'), path.join(DESTINO, 'LEIA-ME.txt'))
  fs.writeFileSync(path.join(DESTINO, 'VERSAO.txt'), `${execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: RAIZ }).toString().trim()} · ${new Date().toISOString().slice(0, 10)}\n`)

  passo('A escrever o manifesto (resumo de cada ficheiro)…')
  manifesto(DESTINO)
  const tam = execFileSync('du', ['-sh', DESTINO]).toString().split('\t')[0]
  console.log(`\nPacote do Portal pronto em ${DESTINO} (${tam}). Copie a pasta ESG-PORTAL para a raiz do pendrive.`)
}

main().catch((e) => { console.error(`\nERRO: ${e.message}`); process.exit(1) })
