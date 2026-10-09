// Carrega os conteúdos atuais do site (src/data) na base de dados da API.
import fs from 'node:fs'
import path from 'node:path'
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'
import config from '../src/config.js'
import db, { transacao } from '../src/db.js'
import { COLECOES, relativizar } from '../src/conteudo.js'
import { nomeSemente } from './nomes.js'

const pastaSite = path.resolve(config.raiz, '..', 'src')

export async function semear({ forcar = false } = {}) {
  if (!fs.existsSync(path.join(pastaSite, 'data'))) {
    console.warn('[semente] Pasta src/data do site não encontrada — a base de dados começa vazia.')
    return
  }
  register('./carregador-dados.js', import.meta.url)

  // 1) imagens do site -> uploads/seed
  const destino = path.join(config.pastaUploads, 'seed')
  fs.mkdirSync(destino, { recursive: true })
  for (const f of fs.readdirSync(path.join(pastaSite, 'assets'))) {
    if (/\.(png|jpe?g|gif|webp|svg)$/i.test(f)) fs.copyFileSync(path.join(pastaSite, 'assets', f), path.join(destino, nomeSemente(f)))
  }

  // 2) dados
  const importar = async (nome) => (await import(pathToFileURL(path.join(pastaSite, 'data', `${nome}.js`)).href)).default
  const fontes = {
    noticias: await importar('noticias'),
    artigos: await importar('artigos'),
    eventos: await importar('eventos'),
    cursos: await importar('cursos'),
    pessoas: await importar('pessoas'),
  }
  const paginas = await importar('paginas')

  transacao(() => {
    if (forcar) {
      db.exec('DELETE FROM itens; DELETE FROM paginas;')
    }
    for (const [colecao, lista] of Object.entries(fontes)) {
      const chave = COLECOES[colecao].chave
      lista.forEach((item, i) => {
        db.prepare('INSERT OR IGNORE INTO itens (colecao, id, dados, ordem) VALUES (?, ?, ?, ?)')
          .run(colecao, String(item[chave]), JSON.stringify(relativizar(item)), i + 1)
      })
    }
    for (const [chave, dados] of Object.entries(paginas)) {
      db.prepare('INSERT OR IGNORE INTO paginas (chave, dados) VALUES (?, ?)').run(chave, JSON.stringify(relativizar(dados)))
    }
  })

  const total = Object.values(fontes).reduce((t, l) => t + l.length, 0)
  console.log(`[semente] ${total} itens e ${Object.keys(paginas).length} páginas carregados.`)
}
