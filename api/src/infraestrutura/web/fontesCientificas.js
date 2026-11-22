/*
  Publicações científicas para o anti-plágio (o mesmo princípio do iThenticate / Crossref Similarity Check, mas com
  bases abertas e gratuitas):
  - OpenAlex (api.openalex.org): mais de 250 milhões de trabalhos — revistas, teses, livros, actas — com os resumos;
    inclui a SciELO e as revistas de língua portuguesa. Sem chave.
  - Crossref (api.crossref.org): os registos das editoras (DOI), com o resumo quando a editora o deposita. Sem chave.
  - CORE (api.core.ac.uk), opcional (chave gratuita): o texto integral de milhões de artigos em acesso aberto.
  Envia-se só a frase pesquisada (nunca o trabalho inteiro, o nome do autor ou da Escola). Devolve, de cada
  publicação, os dados para o relatório e o texto (título, resumo e, no CORE, o texto integral) para comparar.
*/
const AGENTE = 'ESG-Portal-Academico/1.0 (verificacao de originalidade)'
const limpar = (t) => String(t ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

// o OpenAlex guarda o resumo como «índice invertido» (palavra -> posições): volta a montar o texto
export function resumoDoIndice(indice) {
  if (!indice || typeof indice !== 'object') return ''
  const pos = []
  for (const [palavra, lista] of Object.entries(indice)) for (const k of lista) pos[k] = palavra
  return pos.filter(Boolean).join(' ')
}

const doiUrl = (doi) => (doi ? `https://doi.org/${String(doi).replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')}` : null)
const chaveDe = (x) => String(x.doi || x.titulo).toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//, '').replace(/[^a-z0-9]+/g, '')

export class FontesCientificas {
  #ultimo = 0

  constructor({ coreChave = '', intervaloMs = 300, fetch: f = fetch } = {}) {
    this.coreChave = coreChave
    this.intervaloMs = intervaloMs
    this.fetch = f
  }

  get nome() {
    return ['OpenAlex', 'Crossref', ...(this.coreChave ? ['CORE'] : [])].join(', ')
  }

  async #pedir(url, cabecalhos = {}) {
    const espera = this.#ultimo + this.intervaloMs - Date.now()
    if (espera > 0) await new Promise((r) => setTimeout(r, espera))
    this.#ultimo = Date.now()
    const r = await this.fetch(url, { headers: { Accept: 'application/json', 'User-Agent': AGENTE, ...cabecalhos }, signal: AbortSignal.timeout(20_000) })
    if (r.status === 429) throw new Error('Limite de pesquisas atingido (tente mais tarde).')
    if (!r.ok) throw new Error(`respondeu ${r.status}`)
    return r.json()
  }

  async #openAlex(frase, n) {
    const q = new URLSearchParams({ search: frase, 'per-page': String(n), select: 'id,doi,display_name,publication_year,authorships,primary_location,abstract_inverted_index' })
    const d = await this.#pedir(`https://api.openalex.org/works?${q}`)
    return (d.results ?? []).map((w) => ({
      base: 'OpenAlex', doi: w.doi ? String(w.doi).replace(/^https?:\/\/doi\.org\//i, '') : null, titulo: limpar(w.display_name),
      autores: (w.authorships ?? []).map((a) => a.author?.display_name).filter(Boolean).slice(0, 3), ano: w.publication_year ?? null,
      revista: limpar(w.primary_location?.source?.display_name), url: doiUrl(w.doi) || w.primary_location?.landing_page_url || w.id,
      texto: [limpar(w.display_name), resumoDoIndice(w.abstract_inverted_index)].filter(Boolean).join('\n'),
    }))
  }

  async #crossref(frase, n) {
    const q = new URLSearchParams({ 'query.bibliographic': frase, rows: String(n), select: 'DOI,title,author,issued,container-title,abstract,URL' })
    const d = await this.#pedir(`https://api.crossref.org/works?${q}`)
    return (d.message?.items ?? []).map((w) => ({
      base: 'Crossref', doi: w.DOI ?? null, titulo: limpar(w.title?.[0]),
      autores: (w.author ?? []).map((a) => [a.given, a.family].filter(Boolean).join(' ')).filter(Boolean).slice(0, 3),
      ano: w.issued?.['date-parts']?.[0]?.[0] ?? null, revista: limpar(w['container-title']?.[0]), url: doiUrl(w.DOI) || w.URL,
      texto: [limpar(w.title?.[0]), limpar(w.abstract)].filter(Boolean).join('\n'),
    }))
  }

  async #core(frase, n) {
    const q = new URLSearchParams({ q: `"${frase}"`, limit: String(n) })
    const d = await this.#pedir(`https://api.core.ac.uk/v3/search/works?${q}`, { Authorization: `Bearer ${this.coreChave}` })
    return (d.results ?? []).map((w) => ({
      base: 'CORE', doi: w.doi ?? null, titulo: limpar(w.title), autores: (w.authors ?? []).map((a) => a.name).filter(Boolean).slice(0, 3),
      ano: w.yearPublished ?? null, revista: limpar(w.publisher), url: doiUrl(w.doi) || w.downloadUrl || null,
      texto: [limpar(w.title), limpar(w.abstract), String(w.fullText ?? '').slice(0, 400_000)].filter(Boolean).join('\n'),
    }))
  }

  /*
    Pesquisa uma frase nas bases: devolve as publicações (sem repetidas entre bases; fica a que traz mais texto).
    Uma base que falhe não impede as outras; se todas falharem, lança o erro.
  */
  async pesquisar(frase, { resultados = 3 } = {}) {
    const bases = [['OpenAlex', () => this.#openAlex(frase, resultados)], ['Crossref', () => this.#crossref(frase, resultados)]]
    if (this.coreChave) bases.push(['CORE', () => this.#core(frase, resultados)])
    const porChave = new Map()
    const erros = []
    for (const [nome, fazer] of bases) {
      try {
        for (const x of await fazer()) {
          if (!x.titulo) continue
          const k = chaveDe(x)
          const antes = porChave.get(k)
          if (!antes || x.texto.length > antes.texto.length) porChave.set(k, x)
        }
      } catch (e) {
        erros.push(`${nome}: ${e.message}`)
      }
    }
    if (erros.length === bases.length) throw new Error(erros.join('; '))
    return [...porChave.values()]
  }
}
