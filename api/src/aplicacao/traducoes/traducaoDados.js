import { createHash } from 'node:crypto'
import { ErroValidacao } from '../../dominio/comum/erros.js'
import { LINGUAS, textoTraduzivel } from '../../dominio/traducoes/textos.js'

const chaveDe = (texto) => createHash('sha256').update(texto).digest('hex')
// o tradutor recebe no máximo isto de cada vez; o resto fica para o pedido seguinte
const MAXIMO_POR_PEDIDO = 80
// nomes com o posto à frente ("Cap.-Ten. Pedro Neto", "Cor. Ana Baptista") nunca vão ao tradutor
const NOME_COM_POSTO = /(?:\b[A-Z][a-z]{0,4}\.?-)?\b[A-Z][a-z]{0,4}\.\s+\p{Lu}[\p{L}'-]+(?:\s+\p{Lu}[\p{L}'-]+)*/gu

// o nome dá lugar a um nome inventado, que o tradutor deixa como está e que mantém a frase inteira
// (com uma etiqueta no lugar do nome, o tradutor chega a deitar fora o verbo)
const SUBSTITUTOS = ['Zaqarel', 'Vorumin', 'Kelbaz', 'Torvane', 'Mirsal']

// "Cap.-Ten. Pedro Neto respondeu" -> { texto: "Zaqarel respondeu", nomes: ["Cap.-Ten. Pedro Neto"] }
function protegerNomes(texto) {
  const nomes = []
  const t = texto.replace(NOME_COM_POSTO, (m) => {
    if (nomes.length >= SUBSTITUTOS.length) return m
    nomes.push(m)
    return SUBSTITUTOS[nomes.length - 1]
  })
  return { texto: t, nomes }
}
// a tradução só serve se trouxer todos os nomes de volta
function reporNomes(texto, nomes) {
  if (nomes.some((n, i) => !texto.includes(SUBSTITUTOS[i]))) return ''
  return nomes.reduce((t, n, i) => t.replaceAll(SUBSTITUTOS[i], n), texto)
}
// vale a pena traduzir: tirando os nomes, ainda há texto
const traduzivel = (t) => textoTraduzivel(t) || textoTraduzivel(t.replace(NOME_COM_POSTO, '').trim())

/*
  Tradução dos dados que aparecem nos painéis (nomes das cadeiras, capítulos, avisos, notificações,
  títulos das obras…), que não estão nos dicionários da interface. O tradutor automático do servidor
  traduz cada texto uma só vez; a tradução fica guardada e serve a todos.
*/
export class ServicoTraducaoDados {
  #fila = Promise.resolve()

  constructor({ traducoes, tradutor = null, registarErro }) {
    Object.assign(this, { traducoes, tradutor, registarErro })
  }

  // textos em português -> { traducoes: { original: tradução }, pendentes: [os que ficam para o pedido seguinte] }
  async traduzir(_ctx, { lingua, textos }) {
    if (!(lingua in LINGUAS)) throw new ErroValidacao('Língua desconhecida.')
    const unicos = [...new Set(textos.map((t) => String(t).trim()))].filter(traduzivel)
    const chaves = Object.fromEntries(unicos.map((t) => [t, chaveDe(t)]))
    const guardados = unicos.length ? await this.traducoes.textosGuardados(lingua, Object.values(chaves)) : {}
    const traducoes = {}
    const faltam = []
    for (const t of unicos) {
      if (chaves[t] in guardados) traducoes[t] = guardados[chaves[t]]
      else faltam.push(t)
    }
    if (faltam.length && this.tradutor) Object.assign(traducoes, await this.#traduzirNovos(lingua, faltam.slice(0, MAXIMO_POR_PEDIDO), chaves))
    const pendentes = this.tradutor ? unicos.filter((t) => !(t in traducoes)) : []
    // só se devolve o que muda
    for (const [o, t] of Object.entries(traducoes)) if (!t || t === o) delete traducoes[o]
    return { traducoes, pendentes }
  }

  // um pedido ao tradutor de cada vez (o LibreTranslate da Escola é um só)
  #traduzirNovos(lingua, textos, chaves) {
    const p = this.#fila.then(async () => {
      const ainda = await this.traducoes.textosGuardados(lingua, textos.map((t) => chaves[t]))
      const pedir = textos.filter((t) => !(chaves[t] in ainda))
      const r = Object.fromEntries(textos.filter((t) => chaves[t] in ainda).map((t) => [t, ainda[chaves[t]]]))
      if (!pedir.length) return r
      const prot = pedir.map(protegerNomes)
      const mapa = await this.tradutor.traduzirMapa(Object.fromEntries(prot.map((p, i) => [String(i), p.texto])), lingua)
      const novos = pedir.map((t, i) => [t, typeof mapa[String(i)] === 'string' ? reporNomes(mapa[String(i)].trim(), prot[i].nomes) : '']).filter(([, v]) => v)
      await this.traducoes.guardarTextos(lingua, novos.map(([o, v]) => ({ chave: chaves[o], original: o, texto: v })))
      return { ...r, ...Object.fromEntries(novos) }
    }).catch((e) => {
      this.registarErro?.({ nivel: 'erro', mensagem: 'Tradução dos painéis', erro: e.message })
      return {}
    })
    this.#fila = p
    return p
  }
}
