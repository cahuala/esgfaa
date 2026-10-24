import { createHash } from 'node:crypto'
import { ErroValidacao, NaoEncontrado } from '../../dominio/comum/erros.js'
import { LINGUAS, textoTraduzivel } from '../../dominio/traducoes/textos.js'
import { NOME_COM_POSTO } from '../../dominio/traducoes/glossario.js'

const chaveDe = (texto) => createHash('sha256').update(texto).digest('hex')
// o tradutor recebe no máximo isto de cada vez; o resto fica para o pedido seguinte
const MAXIMO_POR_PEDIDO = 80
// vale a pena traduzir: tirando os nomes, ainda há texto
// códigos (cotas «355.41 PIN», siglas «CEO», «FR») não se traduzem: sem minúsculas e curtos
const codigo = (t) => t.length <= 16 && !/\p{Ll}/u.test(t)
const traduzivel = (t) => !codigo(t) && (textoTraduzivel(t) || textoTraduzivel(t.replace(NOME_COM_POSTO, '').trim()))

/*
  Tradução dos dados que aparecem nos painéis (nomes das cadeiras, capítulos, avisos, notificações,
  títulos das obras…), que não estão nos dicionários da interface. O tradutor automático do servidor
  traduz cada texto uma só vez; a tradução fica guardada e serve a todos.
*/
export class ServicoTraducaoDados {
  #fila = Promise.resolve()

  constructor({ traducoes, tradutor = null, auditoria = null, registarErro }) {
    Object.assign(this, { traducoes, tradutor, auditoria, registarErro })
  }

  /*
    Revisão no painel (Traduções dos dados): o tradutor automático erra nas frases soltas; a redação vê o que
    ele traduziu, corrige (fica «revista» e serve a todos) ou apaga (volta a ser traduzida na próxima vez).
  */
  #podeRever(ctx) {
    ctx.actor.exigir('paginas.editar')
  }

  async listarRevisao(ctx, { lingua, q, revisto }) {
    this.#podeRever(ctx)
    if (!(lingua in LINGUAS)) throw new ErroValidacao('Língua desconhecida.')
    return this.traducoes.listarTextos({ lingua, q: String(q || '').trim(), revisto })
  }

  async corrigir(ctx, lingua, chave, texto) {
    this.#podeRever(ctx)
    const t = String(texto ?? '').trim()
    if (!t) throw new ErroValidacao('Escreva a tradução (ou apague-a para voltar a ser traduzida).', { campo: 'texto' })
    const atual = await this.traducoes.lerTexto(lingua, chave)
    if (!atual) throw new NaoEncontrado('Esta tradução já não existe.')
    const r = await this.traducoes.corrigirTexto(lingua, chave, t, ctx.actor.nome || '')
    await this.auditoria?.registar(ctx, { acao: 'corrigir_traducao_dados', colecao: 'traducoes', alvoId: chave, alvoTitulo: atual.original.slice(0, 120), detalhes: { lingua, antes: atual.texto, depois: t } })
    return { chave: r.chave, original: r.original, texto: r.texto, revisto: r.revisto, revistoPor: r.revistoPor }
  }

  async apagarRevisao(ctx, lingua, chave) {
    this.#podeRever(ctx)
    const atual = await this.traducoes.lerTexto(lingua, chave)
    if (!atual) return
    await this.traducoes.apagarTexto(lingua, chave)
    await this.auditoria?.registar(ctx, { acao: 'apagar_traducao_dados', colecao: 'traducoes', alvoId: chave, alvoTitulo: atual.original.slice(0, 120), detalhes: { lingua, texto: atual.texto } })
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
      // o tradutor vem com o glossário (nomes, termos da Escola, ordinais: ver dominio/traducoes/glossario.js)
      const mapa = await this.tradutor.traduzirMapa(Object.fromEntries(pedir.map((t, i) => [String(i), t])), lingua)
      const novos = pedir.map((t, i) => [t, typeof mapa[String(i)] === 'string' ? mapa[String(i)].trim() : '']).filter(([, v]) => v)
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
