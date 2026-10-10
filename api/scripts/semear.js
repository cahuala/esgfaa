// Carrega os conteúdos atuais do site (src/data) na base de dados da API.
import fs from 'node:fs'
import path from 'node:path'
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'
import { RAIZ_API } from '../src/infraestrutura/config.js'
import { COLECOES } from '../src/dominio/conteudos/colecoes.js'
import { relativizar } from '../src/dominio/comum/urls.js'
import { nomeSemente } from './nomes.js'

const pastaSite = path.resolve(RAIZ_API, '..', 'src')

export async function semear({ config, repositorios, transacao }, { forcar = false } = {}) {
  if (!fs.existsSync(path.join(pastaSite, 'data'))) {
    console.warn('[semente] Pasta src/data do site não encontrada — a base de dados começa vazia.')
    return
  }
  register('./carregador-dados.js', import.meta.url)

  // 1) imagens do site -> uploads/seed
  if (config.pastaUploads) {
    const destino = path.join(config.pastaUploads, 'seed')
    fs.mkdirSync(destino, { recursive: true })
    for (const f of fs.readdirSync(path.join(pastaSite, 'assets'))) {
      if (/\.(png|jpe?g|gif|webp|svg)$/i.test(f)) fs.copyFileSync(path.join(pastaSite, 'assets', f), path.join(destino, nomeSemente(f)))
    }
  }

  // 2) dados
  const importar = async (nome) => (await import(pathToFileURL(path.join(pastaSite, 'data', `${nome}.js`)).href)).default
  const fontes = {}
  for (const c of Object.keys(COLECOES)) fontes[c] = await importar(c)
  const paginas = await importar('paginas')

  transacao(() => {
    if (forcar) repositorios.conteudos.apagarTodos()
    for (const [colecao, lista] of Object.entries(fontes)) {
      const chave = COLECOES[colecao].chave
      lista.forEach((item, i) => repositorios.conteudos.semear({
        colecao, id: String(item[chave]), dados: relativizar(item), ordem: i + 1, estado: 'publicado',
      }))
    }
    for (const [chave, dados] of Object.entries(paginas)) repositorios.paginas.semear(chave, relativizar(dados))
  })

  const total = Object.values(fontes).reduce((t, l) => t + l.length, 0)
  console.log(`[semente] ${total} itens e ${Object.keys(paginas).length} páginas carregados.`)
}
