import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente, relogioFalso } from '../apoio/ambiente.js'
import { DOCX, docxComTexto } from '../apoio/documentos.js'

const NOVA = 'Portal2026segura'
// o resumo de um artigo científico, que o estudante copia
const ARTIGO = 'A seguranca maritima no Golfo da Guine depende da partilha de informacao entre as marinhas costeiras e da vigilancia permanente das rotas comerciais. A pirataria e a pesca ilegal exploram as zonas onde a presenca naval e mais fraca e os acordos regionais ainda nao foram ratificados por todos os estados.'
const PROPRIO = 'Na minha unidade fizemos tres exercicios com a capitania de Luanda e todos falharam no mesmo ponto: ninguem sabia quem coordenava o reboque. Proponho uma ficha unica por porto com o contacto de quem decide em cada turno.'

// anti-plágio com publicações científicas (OpenAlex, Crossref): a pesquisa simulada encontra o artigo pelo resumo
describe('anti-plágio com publicações científicas, simuladas', () => {
  let amb, trabalho
  const tokens = {}
  const portal = (quem) => amb.com(tokens[quem])
  const pesquisas = []

  before(async () => {
    const externos = {
      pesquisaWeb: null, obterPagina: null, tradutor: null, claude: null,
      fontesCientificas: {
        nome: 'OpenAlex, Crossref',
        pesquisar: async (frase) => {
          pesquisas.push(frase)
          return ARTIGO.includes(frase.slice(0, 40))
            ? [{ base: 'OpenAlex', doi: '10.1234/seg.2024.7', titulo: 'Segurança marítima no Golfo da Guiné', autores: ['M. Costa', 'J. Lopes'], ano: 2024, revista: 'Revista de Estudos Estratégicos', url: 'https://doi.org/10.1234/seg.2024.7', texto: `Segurança marítima no Golfo da Guiné\n${ARTIGO}` }]
            : []
        },
      },
    }
    amb = await criarAmbiente({ relogio: relogioFalso('2026-11-09T09:00:00Z'), externos })
    const admin = await amb.entrar()
    await amb.com(admin).post('/api/admin/colecoes/cursos').send({ nome: 'Curso de Estado-Maior' })
    const sec = amb.com((await amb.criarUtilizador('administrador')).token)
    const turma = (await sec.post('/api/admin/academico/turmas').send({ curso: 'curso-de-estado-maior', anoLetivo: '2026/2027', nome: 'CEM A' })).body
    const prof = (await sec.post('/api/admin/academico/contas').send({ tipo: 'docente', nome: 'Docente Prof Teste', email: 'prof@esgfaa.gov.ao' })).body
    await amb.registarEMatricular(sec, turma.id, { nome: 'Estudante ana Teste', email: 'ana@esgfaa.gov.ao' })
    const cadeira = (await sec.post(`/api/admin/academico/turmas/${turma.id}/cadeiras`).send({ codigo: 'SEG101', nome: 'Segurança marítima' })).body
    await sec.put(`/api/admin/academico/cadeiras/${cadeira.id}/docentes`).send({ docentes: [{ docenteId: prof.id, papel: 'regente' }] })
    for (const k of ['prof', 'ana']) {
      const email = `${k}@esgfaa.gov.ao`
      const r = await amb.http().post('/api/portal/entrar').send({ email, senha: amb.senhaInicial(email) })
      tokens[k] = (await amb.com(r.body.token).put('/api/portal/eu/senha').send({ atual: amb.senhaInicial(email), nova: NOVA })).body.token
    }
    trabalho = (await portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/trabalhos`).send({ titulo: 'Segurança marítima', prazo: '2026-11-20T23:59:00Z' })).body
  })
  after(() => amb.fechar())

  it('encontra o artigo copiado (com o DOI, os autores e a revista) e o relatório diz o que se consultou', async () => {
    const e = await portal('ana').post(`/api/portal/trabalhos/${trabalho.id}/entrega`).attach('ficheiro', docxComTexto(`${ARTIGO}\n\n${PROPRIO}`), { filename: 'ana.docx', contentType: DOCX })
    assert.equal(e.status, 201, e.body.erro)
    await amb.contentor.servicos.integridade.esvaziar()
    assert.ok(pesquisas.length >= 1)
    const estado = (await portal('prof').get(`/api/portal/trabalhos/${trabalho.id}/integridade`)).body[e.body.id]
    assert.equal(estado.estado, 'concluida')
    assert.ok(estado.percentagem > 40, String(estado.percentagem))
    const r = (await portal('prof').get(`/api/portal/integridade/${estado.id}`)).body
    assert.deepEqual(r.fontes.map((f) => [f.origem, f.url, f.contexto]), [['cientifica', 'https://doi.org/10.1234/seg.2024.7', 'DOI 10.1234/seg.2024.7']])
    assert.match(r.fontes[0].autor, /M\. Costa, J\. Lopes · 2024 · Revista de Estudos Estratégicos/)
    assert.equal(r.origens.cientifica, 'Publicação científica')
    assert.equal(r.verificacoes.cientificas.estado, 'feita')
    assert.equal(r.verificacoes.cientificas.publicacoes, 1)
  })
})
