#!/usr/bin/env node
/*
  Prepara o pendrive de instalação do Sistema de Gestão de Pessoal e Quadros (sem internet na Escola).

    node instalador/preparar-pendrive.mjs [--destino <pasta ou pendrive>] [--organica <quadro.xlsx>] [--so-descarregar]

  1. Descarrega (uma vez, para instalador/.cache) o Node.js, o PostgreSQL, o Caddy e o WinSW, e confere os resumos.
  2. Constrói a página e junta a API com as dependências (só o que corre; sem dados de demonstração).
  3. Converte o Quadro Orgânico (Excel) em organica.json: a instalação carrega as unidades e os cargos.
  4. Copia os instaladores (Windows e Linux) e escreve o MANIFESTO (resumo de cada ficheiro, para o
     instalador saber se a cópia no pendrive está estragada).
  Por omissão a pasta fica em instalador/pendrive/ESG-PESSOAL (fora do git): copie-a para a raiz do pendrive.
*/
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { COMPONENTES } from './componentes.mjs'
import { lerXlsx } from './lerXlsx.mjs'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const RAIZ = path.resolve(AQUI, '..')
const CACHE = path.join(AQUI, '.cache')
const arg = (n, padrao) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : padrao }
const DESTINO = path.resolve(arg('--destino', path.join(AQUI, 'pendrive')), 'ESG-PESSOAL')
const ORGANICA = path.resolve(arg('--organica', path.join(RAIZ, 'docs', 'QUADRO ORGANICO - PARA CARREGAR NO SISTEMA.xlsx')))
const passo = (t) => console.log(`\n» ${t}`)
const sha = (f, alg = 'sha256') => crypto.createHash(alg).update(fs.readFileSync(f)).digest('hex')
const correr = (cmd, args, opcoes = {}) => execFileSync(cmd, args, { stdio: 'inherit', ...opcoes })

async function buscar(url) {
  for (let t = 1; ; t++) {
    try {
      const r = await fetch(url, { redirect: 'follow' })
      if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
      return Buffer.from(await r.arrayBuffer())
    } catch (e) {
      if (t >= 4) throw new Error(`Não foi possível descarregar ${url}: ${e.message}`)
      console.log(`  (falhou: ${e.message}; nova tentativa ${t + 1}/4)`)
    }
  }
}

// 1. componentes (ficam em cache: só se descarregam uma vez)
async function descarregar() {
  fs.mkdirSync(CACHE, { recursive: true })
  for (const c of COMPONENTES) {
    const ficheiro = path.join(CACHE, c.nomeFicheiro ?? path.basename(new URL(c.url).pathname))
    if (!fs.existsSync(ficheiro)) {
      console.log(`  a descarregar ${c.nome}…`)
      // curl: se a ligação cair, volta a tentar e retoma de onde parou (-C -), até 40 vezes
      for (let t = 1; ; t++) {
        try {
          correr('curl', ['-fL', '--connect-timeout', '30', '-C', '-', '-o', `${ficheiro}.parte`, c.url])
          break
        } catch (e) {
          if (t >= 40) throw new Error(`Não foi possível descarregar ${c.nome}: ${e.message}`, { cause: e })
          console.log(`  (a ligação caiu; a retomar, tentativa ${t + 1}/40)`)
          execFileSync('sleep', ['5'])
        }
      }
      fs.renameSync(`${ficheiro}.parte`, ficheiro)
    }
    if (c.somas) {
      const somas = (await buscar(c.somas)).toString()
      const nome = path.basename(ficheiro)
      // o resumo: na linha com o nome do ficheiro (SHASUMS) ou o único que lá está (ficheiro .sha256, seja qual for o formato)
      const tam = (c.algoritmo ?? 'sha256') === 'sha512' ? 128 : 64
      const hex = new RegExp(`\\b[0-9a-f]{${tam}}\\b`, 'i')
      const linha = somas.split('\n').find((l) => l.includes(nome) && hex.test(l))
      const todos = somas.match(new RegExp(hex.source, 'gi')) ?? []
      const esperado = (linha ? hex.exec(linha)?.[0] : todos.length === 1 ? todos[0] : '') ?? ''
      const real = sha(ficheiro, c.algoritmo ?? 'sha256')
      if (!esperado || esperado.toLowerCase() !== real) {
        fs.rmSync(ficheiro)
        throw new Error(`O resumo de ${nome} não confere (esperado ${esperado || '?'}, obtido ${real}). Apagado: corra outra vez.`)
      }
    }
    console.log(`  ✓ ${c.nome}`)
    c.ficheiro = ficheiro
  }
}

// 2. o sistema: página construída + API com as dependências de produção
function sistema(pasta) {
  passo('A construir a página do sistema de pessoal…')
  correr('npm', ['run', 'build'], { cwd: RAIZ, env: { ...process.env, VITE_PESSOAL_API: '', VITE_AMBIENTE: '' } })
  correr('node', ['scripts/preparar-pessoal.mjs', path.join(pasta, 'app')], { cwd: RAIZ })

  passo('A juntar a API e as dependências de produção…')
  const api = path.join(RAIZ, 'api-pessoal')
  for (const f of ['package.json', 'package-lock.json', 'prisma.config.js']) fs.copyFileSync(path.join(api, f), path.join(pasta, f))
  fs.cpSync(path.join(api, 'src'), path.join(pasta, 'src'), { recursive: true })
  fs.cpSync(path.join(api, 'prisma'), path.join(pasta, 'prisma'), { recursive: true })
  fs.mkdirSync(path.join(pasta, 'scripts'), { recursive: true })
  // só os scripts da instalação e das cópias (os de demonstração — semear, preencher — não vão)
  for (const f of ['migrar.js', 'instalar-organica.js', 'simularAparelhoPonto.js']) fs.copyFileSync(path.join(api, 'scripts', f), path.join(pasta, 'scripts', f))
  fs.copyFileSync(path.join(RAIZ, 'scripts', 'copias.mjs'), path.join(pasta, 'scripts', 'copias.mjs'))
  correr('npm', ['ci', '--omit=dev', '--no-audit', '--no-fund'], { cwd: pasta })
  // o cliente do Prisma é JavaScript + WebAssembly (serve em qualquer sistema); o que só serve para o
  // programador (a linha de comandos do Prisma e os motores desta máquina) não vai
  for (const d of ['prisma', '@prisma/engines', '@prisma/studio-core', '@prisma/fetch-engine', '@prisma/get-platform', '@prisma/dev']) fs.rmSync(path.join(pasta, 'node_modules', d), { recursive: true, force: true })
  fs.rmSync(path.join(pasta, 'node_modules', '.bin'), { recursive: true, force: true })
}

// 3. o Quadro Orgânico real (só no pendrive; nunca no repositório)
async function organica(pasta) {
  passo('A converter o Quadro Orgânico…')
  if (!fs.existsSync(ORGANICA)) {
    console.log(`  (sem ${path.basename(ORGANICA)}: a instalação fica sem orgânica; carrega-se depois em Orgânica › Importar)`)
    return
  }
  const tabela = await lerXlsx(fs.readFileSync(ORGANICA))
  const [cab, ...resto] = tabela
  const sem = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  const CAMPOS = { unidade: 'unidade', sigla: 'sigla', 'tipo de unidade': 'tipo', 'unidade superior': 'superior', cargo: 'cargo', funcao: 'funcao', posto: 'posto', 'categoria civil': 'categoriaCivil', lugares: 'lugares' }
  const idx = cab.map((h) => CAMPOS[sem(h)])
  if (!idx.includes('unidade')) throw new Error('O Quadro Orgânico tem de ter a coluna «Unidade».')
  const linhas = resto.map((l) => Object.fromEntries(idx.map((k, i) => [k, String(l[i] ?? '').trim()]).filter(([k]) => k))).filter((l) => Object.values(l).some(Boolean))
  fs.writeFileSync(path.join(pasta, 'organica.json'), JSON.stringify(linhas))
  console.log(`  ✓ ${linhas.length} linha(s) (unidades e cargos)`)
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
  passo('A descarregar os componentes (só da primeira vez)…')
  await descarregar()
  // bibliotecas do sistema para o PostgreSQL em Linux mínimos (recolhidas num Ubuntu 22.04, com o Docker)
  const libs = path.join(CACHE, 'postgresql-linux-bibliotecas.tar.gz')
  if (!fs.existsSync(libs)) {
    console.log('  a recolher as bibliotecas do PostgreSQL para Linux (Docker)…')
    correr('bash', [path.join(AQUI, 'bibliotecas-linux.sh'), COMPONENTES.find((c) => c.id === 'postgresql-linux').ficheiro, libs])
  }
  console.log('  ✓ Bibliotecas do PostgreSQL para Linux')
  if (process.argv.includes('--so-descarregar')) return

  fs.rmSync(DESTINO, { recursive: true, force: true })
  const comp = path.join(DESTINO, 'componentes')
  const sis = path.join(DESTINO, 'sistema')
  for (const d of [comp, sis, path.join(DESTINO, 'registos')]) fs.mkdirSync(d, { recursive: true })
  fs.copyFileSync(libs, path.join(comp, 'postgresql-linux-bibliotecas.tar.gz'))
  for (const c of COMPONENTES) fs.copyFileSync(c.ficheiro, path.join(comp, `${c.id}${path.extname(c.ficheiro) === '.exe' ? '.exe' : c.ficheiro.endsWith('.tar.xz') ? '.tar.xz' : c.ficheiro.endsWith('.tar.gz') ? '.tar.gz' : '.zip'}`))

  sistema(sis)
  await organica(sis)

  passo('A copiar os instaladores…')
  fs.cpSync(path.join(AQUI, 'windows'), path.join(DESTINO, 'windows'), { recursive: true })
  fs.cpSync(path.join(AQUI, 'linux'), path.join(DESTINO, 'linux'), { recursive: true })
  for (const f of ['INSTALAR-WINDOWS.bat', 'INSTALAR-LINUX.sh', 'INSTALAR-LINUX.desktop', 'PREPARAR-COMPUTADOR-WINDOWS.bat', 'PREPARAR-COMPUTADOR-LINUX.sh', 'LEIA-ME.txt']) fs.copyFileSync(path.join(AQUI, f), path.join(DESTINO, f))
  for (const f of ['INSTALAR-LINUX.sh', 'INSTALAR-LINUX.desktop', 'PREPARAR-COMPUTADOR-LINUX.sh', 'linux/instalar.sh']) fs.chmodSync(path.join(DESTINO, f), 0o755)
  fs.writeFileSync(path.join(DESTINO, 'VERSAO.txt'), `${execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: RAIZ }).toString().trim()} · ${new Date().toISOString().slice(0, 10)}\n`)

  passo('A escrever o manifesto (resumo de cada ficheiro)…')
  manifesto(DESTINO)
  const tam = execFileSync('du', ['-sh', DESTINO]).toString().split('\t')[0]
  console.log(`\nPendrive pronto em ${DESTINO} (${tam}). Copie a pasta ESG-PESSOAL para a raiz do pendrive.`)
}

main().catch((e) => { console.error(`\nERRO: ${e.message}`); process.exit(1) })
