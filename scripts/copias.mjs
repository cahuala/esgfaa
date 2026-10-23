#!/usr/bin/env node
/*
  Cópias de segurança cifradas da ESG (bases de dados + ficheiros carregados).

    node scripts/copias.mjs copiar [--sistema tudo|portal|pessoal]   faz uma cópia (para correr todos os dias)
    node scripts/copias.mjs listar                                    mostra as cópias guardadas
    node scripts/copias.mjs testar <ficheiro.esgc>                    decifra e repõe numa base temporária (prova que serve)
    node scripts/copias.mjs repor <ficheiro.esgc> --para <pasta>      decifra e extrai (dumps + ficheiros) para repor
    node scripts/copias.mjs agendar [--sistema tudo|portal|pessoal]   fica a correr: uma cópia por dia (serviço «copias» do Docker)

  Cada cópia: dump do PostgreSQL (formato custom) de cada sistema e as pastas de dados (uploads, privado,
  fotos, ficheiros), num .tar.gz cifrado com AES-256-GCM (COPIAS_CHAVE, diferente da DADOS_CHAVE).
  Ficam as últimas COPIAS_MANTER (30). Guarde a COPIAS_CHAVE fora do servidor: sem ela as cópias não abrem.

  Variáveis: COPIAS_CHAVE (obrigatória: openssl rand -hex 32), COPIAS_DIR (./copias), COPIAS_MANTER (30),
  PORTAL_DATABASE_URL e PESSOAL_DATABASE_URL (por omissão, as dos .env de api/ e api-pessoal/),
  PG_DOCKER (nome do contentor do PostgreSQL, se o pg_dump não estiver instalado no servidor),
  PORTAL_DADOS (api/dados) e PESSOAL_DADOS (api-pessoal/dados).
  Com «agendar»: COPIAS_HORA (2: às 2h, na hora de TZ), COPIAS_EXTRA (outra pasta, p. ex. um disco externo ou
  uma partilha de outro servidor montada no contentor, onde fica também cada cópia) e o teste de reposição
  automático no dia 1 de cada mês. O resultado de cada cópia fica em COPIAS_DIR/estado.json.
*/
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const MAGICO = Buffer.from('ESGC1\n')
const IV = 12
const ETIQUETA = 16

function lerEnv(ficheiro) {
  try {
    return Object.fromEntries(fs.readFileSync(ficheiro, 'utf8').split('\n').map((l) => /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/.exec(l)).filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, '')]))
  } catch {
    return {}
  }
}

function configuracao() {
  const envApi = lerEnv(path.join(RAIZ, 'api/.env'))
  const envPessoal = lerEnv(path.join(RAIZ, 'api-pessoal/.env'))
  const e = process.env
  return {
    chave: e.COPIAS_CHAVE,
    pasta: path.resolve(e.COPIAS_DIR || path.join(RAIZ, 'copias')),
    manter: Number(e.COPIAS_MANTER || 30),
    docker: e.PG_DOCKER || '',
    sistemas: {
      portal: { url: e.PORTAL_DATABASE_URL || envApi.DATABASE_URL || 'postgresql://esgfaa:esgfaa_dev@localhost:5434/esgfaa', dados: path.resolve(e.PORTAL_DADOS || path.join(RAIZ, 'api', envApi.DATA_DIR || 'dados')) },
      pessoal: { url: e.PESSOAL_DATABASE_URL || envPessoal.DATABASE_URL || 'postgresql://pessoal:pessoal_dev@localhost:5434/esgfaa_pessoal', dados: path.resolve(e.PESSOAL_DADOS || path.join(RAIZ, 'api-pessoal', envPessoal.DATA_DIR || 'dados')) },
    },
  }
}

function chaveDe(texto) {
  if (!texto) throw new Error('Defina COPIAS_CHAVE (32 bytes aleatórios: openssl rand -hex 32). Guarde-a fora do servidor.')
  const base = Buffer.from(texto, /^[0-9a-f]{64}$/i.test(texto) ? 'hex' : 'base64')
  if (base.length < 32) throw new Error('COPIAS_CHAVE tem de ter 32 bytes (64 caracteres hexadecimais).')
  return Buffer.from(crypto.hkdfSync('sha256', base, Buffer.alloc(0), 'esgfaa/copias', 32))
}

// corre um programa; entrada/saída opcionais (streams); devolve o código de saída
function correr(cmd, args, { entrada, saida, env } = {}) {
  return new Promise((ok, falha) => {
    const p = spawn(cmd, args, { stdio: [entrada ? 'pipe' : 'ignore', saida ? 'pipe' : 'inherit', 'inherit'], env: { ...process.env, ...env } })
    if (entrada) entrada.pipe(p.stdin)
    if (saida) p.stdout.pipe(saida)
    p.on('error', falha)
    p.on('close', (c) => (c === 0 ? ok() : falha(new Error(`${cmd} ${args[0] ?? ''} terminou com o código ${c}`))))
  })
}

// pg_dump / pg_restore / psql: no servidor ou dentro do contentor do PostgreSQL
function pg(cfg, programa, url, extra) {
  const u = new URL(url)
  const base = ['-U', decodeURIComponent(u.username), ...(cfg.docker ? [] : ['-h', u.hostname, '-p', u.port || '5432'])]
  const env = { PGPASSWORD: decodeURIComponent(u.password) }
  if (cfg.docker) return { cmd: 'docker', args: ['exec', '-i', '-e', `PGPASSWORD=${env.PGPASSWORD}`, cfg.docker, programa, ...base, ...extra], env: {} }
  return { cmd: programa, args: [...base, ...extra], env }
}
const nomeBd = (url) => decodeURIComponent(new URL(url).pathname.slice(1))

async function cifrar(origem, destino, chave) {
  const iv = crypto.randomBytes(IV)
  const c = crypto.createCipheriv('aes-256-gcm', chave, iv)
  const out = fs.createWriteStream(destino)
  out.write(MAGICO)
  out.write(iv)
  await pipeline(fs.createReadStream(origem), c, out, { end: false })
  await new Promise((ok, falha) => out.end(c.getAuthTag(), (e) => (e ? falha(e) : ok())))
}

async function decifrar(origem, destino, chave) {
  const tam = fs.statSync(origem).size
  const fd = fs.openSync(origem, 'r')
  const cab = Buffer.alloc(MAGICO.length + IV)
  fs.readSync(fd, cab, 0, cab.length, 0)
  if (!cab.subarray(0, MAGICO.length).equals(MAGICO)) throw new Error('Não é uma cópia de segurança da ESG.')
  const etiqueta = Buffer.alloc(ETIQUETA)
  fs.readSync(fd, etiqueta, 0, ETIQUETA, tam - ETIQUETA)
  fs.closeSync(fd)
  const d = crypto.createDecipheriv('aes-256-gcm', chave, cab.subarray(MAGICO.length))
  d.setAuthTag(etiqueta)
  try {
    await pipeline(fs.createReadStream(origem, { start: cab.length, end: tam - ETIQUETA - 1 }), d, fs.createWriteStream(destino))
  } catch {
    fs.rmSync(destino, { force: true })
    throw new Error('Não foi possível decifrar: a COPIAS_CHAVE não é a desta cópia, ou o ficheiro foi alterado ou está incompleto.')
  }
}

const resumo = (f) => new Promise((ok, falha) => {
  const h = crypto.createHash('sha256')
  fs.createReadStream(f).on('data', (b) => h.update(b)).on('end', () => ok(h.digest('hex'))).on('error', falha)
})

async function copiar(cfg, sistema = 'tudo') {
  const chave = chaveDe(cfg.chave)
  const quais = sistema === 'tudo' ? Object.keys(cfg.sistemas) : [sistema]
  if (quais.some((s) => !cfg.sistemas[s])) throw new Error(`Sistema desconhecido: ${sistema} (tudo, portal ou pessoal).`)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'esg-copia-'))
  try {
    for (const s of quais) {
      const { url, dados } = cfg.sistemas[s]
      fs.mkdirSync(path.join(tmp, s))
      const p = pg(cfg, 'pg_dump', url, ['-d', nomeBd(url), '-Fc', '--no-owner', '--no-privileges'])
      await correr(p.cmd, p.args, { env: p.env, saida: fs.createWriteStream(path.join(tmp, s, 'base.dump')) })
      if (fs.existsSync(dados)) fs.cpSync(dados, path.join(tmp, s, 'dados'), { recursive: true })
      console.log(`  ${s}: base de dados ${nomeBd(url)}${fs.existsSync(dados) ? ` + ficheiros (${dados})` : ''}`)
    }
    const quando = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const tar = path.join(os.tmpdir(), `esg-${quando}.tar.gz`)
    await correr('tar', ['-czf', tar, '-C', tmp, '.'])
    fs.mkdirSync(cfg.pasta, { recursive: true, mode: 0o700 })
    const destino = path.join(cfg.pasta, `esg-${sistema}-${quando}.esgc`)
    await cifrar(tar, destino, chave)
    fs.rmSync(tar, { force: true })
    fs.chmodSync(destino, 0o600)
    const info = { criadaEm: new Date().toISOString(), sistemas: quais, tamanho: fs.statSync(destino).size, sha256: await resumo(destino) }
    fs.writeFileSync(`${destino}.json`, JSON.stringify(info, null, 2), { mode: 0o600 })
    console.log(`Cópia cifrada: ${destino} (${(info.tamanho / 1048576).toFixed(1)} MB)`)
    // retenção: ficam as últimas N
    const todas = fs.readdirSync(cfg.pasta).filter((f) => f.endsWith('.esgc')).sort()
    for (const f of todas.slice(0, Math.max(0, todas.length - cfg.manter))) {
      fs.rmSync(path.join(cfg.pasta, f), { force: true })
      fs.rmSync(path.join(cfg.pasta, `${f}.json`), { force: true })
      console.log(`  apagada a antiga: ${f}`)
    }
    return destino
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}

async function abrir(cfg, ficheiro, pasta) {
  const chave = chaveDe(cfg.chave)
  const info = fs.existsSync(`${ficheiro}.json`) ? JSON.parse(fs.readFileSync(`${ficheiro}.json`, 'utf8')) : null
  if (info && (await resumo(ficheiro)) !== info.sha256) throw new Error('O ficheiro não corresponde ao resumo guardado (alterado ou incompleto).')
  const tar = path.join(os.tmpdir(), `esg-repor-${process.pid}.tar.gz`)
  await decifrar(ficheiro, tar, chave)
  fs.mkdirSync(pasta, { recursive: true, mode: 0o700 })
  await correr('tar', ['-xzf', tar, '-C', pasta])
  fs.rmSync(tar, { force: true })
  return fs.readdirSync(pasta).filter((s) => fs.existsSync(path.join(pasta, s, 'base.dump')))
}

// repõe cada base numa base temporária, conta tabelas e linhas, e apaga-a: prova que a cópia serve
async function testar(cfg, ficheiro) {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'esg-teste-'))
  try {
    const sistemas = await abrir(cfg, ficheiro, pasta)
    const admin = process.env.PG_ADMIN_URL || cfg.sistemas[sistemas[0]].url
    console.log(`Decifrada e verificada: ${sistemas.join(', ')}`)
    for (const s of sistemas) {
      const temp = `esg_teste_reposicao_${s}_${Date.now()}`
      const psql = (sql, bd = nomeBd(admin)) => pg(cfg, 'psql', admin, ['-d', bd, '-q', '-v', 'ON_ERROR_STOP=1', '-tAc', sql])
      const criar = psql(`CREATE DATABASE "${temp}"`)
      await correr(criar.cmd, criar.args, { env: criar.env })
      try {
        const r = pg(cfg, 'pg_restore', admin, ['-d', temp, '--no-owner', '--no-privileges', '--exit-on-error'])
        await correr(r.cmd, r.args, { env: r.env, entrada: fs.createReadStream(path.join(pasta, s, 'base.dump')) })
        const contar = psql("SELECT count(*) || ' tabelas, ' || (SELECT sum(n_live_tup) FROM pg_stat_user_tables) || ' linhas (estimativa)' FROM information_schema.tables WHERE table_schema = 'public'", temp)
        process.stdout.write(`  ${s}: reposta numa base temporária — `)
        await correr(contar.cmd, contar.args, { env: contar.env })
        const ficheiros = path.join(pasta, s, 'dados')
        if (fs.existsSync(ficheiros)) console.log(`  ${s}: ${fs.readdirSync(ficheiros, { recursive: true }).length} ficheiro(s)/pasta(s) de dados`)
      } finally {
        const apagar = psql(`DROP DATABASE IF EXISTS "${temp}"`)
        await correr(apagar.cmd, apagar.args, { env: apagar.env }).catch(() => {})
      }
    }
    console.log('Teste de reposição: OK.')
  } finally {
    fs.rmSync(pasta, { recursive: true, force: true })
  }
}

// a cópia de cada dia, para sempre: copia, leva para COPIAS_EXTRA, testa a reposição no dia 1 e regista o estado
async function agendar(cfg, sistema) {
  chaveDe(cfg.chave)
  const hora = Number(process.env.COPIAS_HORA ?? 2)
  const extra = process.env.COPIAS_EXTRA ? path.resolve(process.env.COPIAS_EXTRA) : ''
  const estado = (x) => fs.writeFileSync(path.join(cfg.pasta, 'estado.json'), JSON.stringify({ ...x, sistema, quando: new Date().toISOString() }, null, 2), { mode: 0o600 })
  fs.mkdirSync(cfg.pasta, { recursive: true, mode: 0o700 })
  console.log(`Cópias agendadas: ${sistema}, todos os dias às ${hora}h${extra ? `, também em ${extra}` : ''}.`)
  for (;;) {
    const proxima = new Date()
    proxima.setHours(hora, 0, 0, 0)
    if (proxima <= new Date()) proxima.setDate(proxima.getDate() + 1)
    await new Promise((ok) => setTimeout(ok, proxima - new Date()))
    try {
      const f = await copiar(cfg, sistema)
      if (extra) {
        fs.mkdirSync(extra, { recursive: true })
        for (const x of [f, `${f}.json`]) fs.copyFileSync(x, path.join(extra, path.basename(x)))
        const la = fs.readdirSync(extra).filter((x) => x.endsWith('.esgc')).sort()
        for (const x of la.slice(0, Math.max(0, la.length - cfg.manter))) for (const y of [x, `${x}.json`]) fs.rmSync(path.join(extra, y), { force: true })
        console.log(`  levada também para ${extra}`)
      }
      if (new Date().getDate() === 1) await testar(cfg, f)
      estado({ ok: true, ficheiro: path.basename(f), extra: Boolean(extra) })
    } catch (e) {
      console.error(`Erro na cópia de ${new Date().toISOString()}: ${e.message}`)
      estado({ ok: false, erro: e.message })
    }
  }
}

const [comando, ...resto] = process.argv.slice(2)
const opcao = (n) => { const i = resto.indexOf(`--${n}`); return i >= 0 ? resto[i + 1] : undefined }
const cfg = configuracao()
try {
  if (comando === 'copiar') await copiar(cfg, opcao('sistema') || 'tudo')
  else if (comando === 'agendar') await agendar(cfg, opcao('sistema') || 'tudo')
  else if (comando === 'listar') {
    if (!fs.existsSync(cfg.pasta)) console.log('Ainda não há cópias.')
    else for (const f of fs.readdirSync(cfg.pasta).filter((x) => x.endsWith('.esgc')).sort()) console.log(`${f}  ${(fs.statSync(path.join(cfg.pasta, f)).size / 1048576).toFixed(1)} MB`)
  } else if (comando === 'testar' && resto[0]) await testar(cfg, path.resolve(resto[0]))
  else if (comando === 'repor' && resto[0] && opcao('para')) {
    const s = await abrir(cfg, path.resolve(resto[0]), path.resolve(opcao('para')))
    console.log(`Extraído para ${path.resolve(opcao('para'))}: ${s.join(', ')}.`)
    console.log('Para repor a base: pg_restore --clean --if-exists --no-owner -d <base> <pasta>/<sistema>/base.dump; os ficheiros estão em <pasta>/<sistema>/dados.')
  } else {
    console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0].replace(/^#!.*\n\/\*\n?/, ''))
    process.exitCode = comando ? 1 : 0
  }
} catch (e) {
  console.error(`Erro: ${e.message}`)
  process.exitCode = 1
}
