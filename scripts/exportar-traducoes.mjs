/*
  Copia para o site (src/data/traducoes.json) as traduções publicadas na API, para que o site
  publicado sem API (GitHub Pages) também mostre os conteúdos noutras línguas.
  Só entra um texto se o original na API for igual ao que o site traz em src/data;
  assim uma tradução nunca aparece por cima de um texto diferente.

  Uso: com a API a correr, `npm run traducoes:exportar` (API_URL=http://localhost:3001 por omissão).
*/
import { writeFile } from 'node:fs/promises'
import { createServer } from 'vite'

const API = process.env.API_URL || 'http://localhost:3001'
const COLECOES = [['noticias', 'slug'], ['artigos', 'slug'], ['eventos', 'id'], ['cursos', 'id'], ['pessoas', 'id']]

const remoto = await (await fetch(`${API}/api/publico/conteudo`)).json()
if (!remoto.traducoes) throw new Error('A API não devolveu traduções.')

// os dados do site importam imagens: carregam-se pelo Vite, como no site
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const local = {}
for (const c of [...COLECOES.map(([c]) => c), 'paginas']) local[c] = (await vite.ssrLoadModule(`/src/data/${c}.js`)).default
await vite.close()

const valor = (obj, caminho) => caminho.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj)
const porChave = (lista, campo) => Object.fromEntries((lista || []).map((x) => [x[campo], x]))
const originais = { paginas: [remoto.paginas, local.paginas] }
for (const [c, campo] of COLECOES) originais[c] = [porChave(remoto[c], campo), porChave(local[c], campo)]

const itens = {}
let textos = 0
let ignorados = 0
for (const [alvo, porLingua] of Object.entries(remoto.traducoes.itens)) {
  const [colecao, chave] = alvo.split('/')
  const [daApi, doSite] = (originais[colecao] || []).map((m) => m?.[chave])
  if (!daApi || !doSite) continue
  for (const [lingua, mapa] of Object.entries(porLingua)) {
    const iguais = Object.entries(mapa).filter(([caminho]) => {
      const igual = typeof valor(doSite, caminho) === 'string' && valor(doSite, caminho) === valor(daApi, caminho)
      if (!igual) ignorados++
      return igual
    })
    if (!iguais.length) continue
    itens[alvo] = { ...itens[alvo], [lingua]: Object.fromEntries(iguais) }
    textos += iguais.length
  }
}
const automaticas = Object.fromEntries(Object.entries(remoto.traducoes.automaticas || {}).filter(([k]) => itens[k]))
await writeFile(new URL('../src/data/traducoes.json', import.meta.url), `${JSON.stringify({ linguas: remoto.traducoes.linguas, itens, automaticas }, null, 1)}\n`)
console.log(`${Object.keys(itens).length} conteúdos, ${textos} textos traduzidos (${ignorados} ignorados por o original ser diferente).`)
