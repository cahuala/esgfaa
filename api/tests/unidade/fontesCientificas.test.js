import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { FontesCientificas, resumoDoIndice } from '../../src/infraestrutura/web/fontesCientificas.js'

const resposta = (corpo, status = 200) => ({ ok: status < 400, status, json: async () => corpo })

describe('publicações científicas (OpenAlex, Crossref, CORE)', () => {
  it('monta o resumo do OpenAlex a partir do índice invertido', () => {
    assert.equal(resumoDoIndice({ defesa: [1], A: [0], territorial: [2] }), 'A defesa territorial')
    assert.equal(resumoDoIndice(null), '')
  })

  it('junta as bases, tira as etiquetas do Crossref e não repete a mesma publicação (DOI)', async () => {
    const pedidos = []
    const f = new FontesCientificas({ intervaloMs: 0, fetch: async (url) => {
      pedidos.push(url)
      if (url.includes('openalex')) return resposta({ results: [{ id: 'https://openalex.org/W1', doi: 'https://doi.org/10.1/abc', display_name: 'Defesa territorial', publication_year: 2020, authorships: [{ author: { display_name: 'A. Silva' } }], primary_location: { source: { display_name: 'Revista de Estudos Militares' } }, abstract_inverted_index: { Resumo: [0], curto: [1] } }] })
      return resposta({ message: { items: [
        { DOI: '10.1/abc', title: ['Defesa territorial'], abstract: '<jats:p>Resumo muito mais completo da publicação sobre defesa territorial.</jats:p>', author: [{ given: 'Ana', family: 'Silva' }], issued: { 'date-parts': [[2020]] } },
        { DOI: '10.2/xyz', title: ['Segurança marítima'], abstract: '<jats:p>Golfo da Guiné.</jats:p>' },
      ] } })
    } })
    const l = await f.pesquisar('a doutrina de defesa territorial', { resultados: 3 })
    assert.equal(pedidos.length, 2) // sem chave do CORE: só OpenAlex e Crossref
    assert.equal(l.length, 2)
    const abc = l.find((x) => x.doi === '10.1/abc')
    assert.match(abc.texto, /Resumo muito mais completo/) // ficou a que traz mais texto
    assert.ok(!abc.texto.includes('<jats'))
    assert.equal(abc.url, 'https://doi.org/10.1/abc')
    assert.equal(f.nome, 'OpenAlex, Crossref')
  })

  it('uma base em baixo não impede a outra; todas em baixo dá erro', async () => {
    const meio = new FontesCientificas({ intervaloMs: 0, fetch: async (url) => (url.includes('openalex') ? resposta({}, 503) : resposta({ message: { items: [{ DOI: '10.3/q', title: ['Título'], abstract: 'x' }] } })) })
    assert.equal((await meio.pesquisar('frase')).length, 1)
    const nada = new FontesCientificas({ intervaloMs: 0, fetch: async () => resposta({}, 503) })
    await assert.rejects(() => nada.pesquisar('frase'), /OpenAlex: respondeu 503; Crossref: respondeu 503/)
  })
})
