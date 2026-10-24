// Reduz as imagens já carregadas (as novas já se reduzem ao carregar): cada fotografia pesada passa a
// WebP com 2000 px no máximo, e os endereços na base de dados (notícias, páginas, capas…) passam para o
// ficheiro novo. Pode correr-se mais do que uma vez: as imagens já leves ficam como estão.
//   npm run otimizar-imagens            (mostra o que faria)
//   npm run otimizar-imagens -- --gravar
import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'
import { criarConfig } from '../src/infraestrutura/config.js'
import { otimizarImagem } from '../src/infraestrutura/ficheiros/imagens.js'

const TIPO = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' }
const gravar = process.argv.includes('--gravar')
const config = criarConfig()
const raiz = config.pastaUploads
if (!fs.existsSync(raiz)) { console.log('Sem pasta de uploads.'); process.exit(0) }

const ficheiros = fs.readdirSync(raiz, { recursive: true }).map((r) => path.join(raiz, String(r))).filter((f) => TIPO[path.extname(f).toLowerCase()] && fs.statSync(f).isFile())
const url = (f) => `/uploads/${path.relative(raiz, f).split(path.sep).join('/')}`
const trocas = []
let antes = 0
let depois = 0
for (const f of ficheiros) {
  const tamanho = fs.statSync(f).size
  if (!gravar) {
    // sem gravar: uma cópia temporária, para mostrar quanto se ganha sem mexer em nada
    const copia = `${f}.prova${path.extname(f)}`
    fs.copyFileSync(f, copia)
    const r = await otimizarImagem({ caminho: copia, tipo: TIPO[path.extname(f).toLowerCase()], tamanho })
    if (r.caminho !== copia) { antes += tamanho; depois += r.tamanho; console.log(`${url(f)}  ${(tamanho / 1024).toFixed(0)} KB → ${(r.tamanho / 1024).toFixed(0)} KB`) }
    fs.rmSync(r.caminho, { force: true })
    fs.rmSync(copia, { force: true })
    continue
  }
  const r = await otimizarImagem({ caminho: f, tipo: TIPO[path.extname(f).toLowerCase()], tamanho })
  if (r.caminho === f) continue
  antes += tamanho
  depois += r.tamanho
  trocas.push([url(f), url(r.caminho)])
  console.log(`${url(f)} → ${url(r.caminho)}  ${(tamanho / 1024).toFixed(0)} KB → ${(r.tamanho / 1024).toFixed(0)} KB`)
}
console.log(`\n${gravar ? trocas.length : 'a reduzir:'} ${(antes / 1048576).toFixed(1)} MB → ${(depois / 1048576).toFixed(1)} MB`)

if (gravar && trocas.length) {
  // os endereços podem estar em qualquer texto (conteúdos em JSON, capas, anexos): troca-se o caminho exacto
  const bd = new pg.Client({ connectionString: config.urlBaseDados })
  await bd.connect()
  const colunas = (await bd.query(`SELECT table_name, column_name, data_type FROM information_schema.columns
    WHERE table_schema = 'public' AND data_type IN ('text', 'character varying', 'json', 'jsonb')`)).rows
  const id = (s) => `"${s.replace(/"/g, '""')}"`
  let linhas = 0
  await bd.query('BEGIN')
  for (const { table_name: t, column_name: c, data_type: tipo } of colunas) {
    for (const [de, para] of trocas) {
      const r = await bd.query(`UPDATE ${id(t)} SET ${id(c)} = replace(${id(c)}::text, $1, $2)::${tipo === 'character varying' ? 'varchar' : tipo} WHERE ${id(c)}::text LIKE '%' || $1 || '%'`, [de, para])
      linhas += r.rowCount
    }
  }
  await bd.query('COMMIT')
  await bd.end()
  console.log(`${linhas} referência(s) actualizada(s) na base de dados.`)
}
