import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente, relogioFalso } from '../apoio/ambiente.js'
import { DOCX, docxComTexto } from '../apoio/documentos.js'

const NOVA = 'Portal2026segura'
// texto publicado num site, que o estudante copia
const SITE = 'A doutrina de defesa territorial assenta na mobilizacao rapida das reservas e na protecao das infraestruturas criticas. Os planos regionais definem responsabilidades claras para cada comando e preveem exercicios anuais com as autoridades civis. A logistica de proximidade garante o apoio continuo das unidades destacadas nas fronteiras.'
const PROPRIO = 'No meu batalhao fizemos tres exercicios com a protecao civil em Benguela e todos falharam no mesmo ponto: ninguem sabia quem coordenava o transporte das reservas. Proponho uma ficha unica por provincia, revista em cada exercicio, com nomes e telefones e nao apenas cargos.'

describe('anti-plágio com internet (Brave) e avaliação de IA (Claude), simulados', () => {
  let amb, trabalho
  const tokens = {}
  const portal = (quem) => amb.com(tokens[quem])
  const pesquisas = []
  const pedidosClaude = []

  before(async () => {
    const externos = {
      // a pesquisa encontra o site para as frases que lá estão; para as outras, só uma página sem relação
      pesquisaWeb: { pesquisar: async (frase) => { pesquisas.push(frase); return SITE.includes(frase.slice(0, 40)) ? [{ titulo: 'Defesa territorial', url: 'https://defesa.exemplo.ao/doutrina' }] : [{ titulo: 'Outra', url: 'https://outro.exemplo.ao/' }] } },
      obterPagina: async (url) => (url.includes('defesa') ? { url, titulo: 'Doutrina de defesa territorial', texto: `Menu Inicio\n${SITE}\nContactos` } : { url, titulo: 'Outra', texto: 'Pagina sem relacao nenhuma com o trabalho, apenas noticias desportivas e meteorologia para o fim de semana em varias provincias.'.repeat(3) }),
      // sem tradução automática: aqui o Claude simulado só avalia a utilização de IA
      tradutor: null,
      claude: { json: async ({ conteudo }) => { pedidosClaude.push(conteudo); return { probabilidade: 72, avaliacao: 'Texto genérico e muito regular.', paragrafos: [{ n: 1, probabilidade: 80, motivo: 'Fórmulas genéricas' }, { n: 9, probabilidade: 99, motivo: 'não existe' }] } } },
    }
    amb = await criarAmbiente({ relogio: relogioFalso('2026-11-09T09:00:00Z'), externos })
    const admin = await amb.entrar()
    await amb.com(admin).post('/api/admin/colecoes/cursos').send({ nome: 'Curso de Estado-Maior' })
    const sec = amb.com((await amb.criarUtilizador('administrador')).token)
    const turma = (await sec.post('/api/admin/academico/turmas').send({ curso: 'curso-de-estado-maior', anoLetivo: '2026/2027', nome: 'CEM A' })).body
    const prof = (await sec.post('/api/admin/academico/contas').send({ tipo: 'docente', nome: 'Docente Prof Teste', email: 'prof@esgfaa.gov.ao' })).body
    await amb.registarEMatricular(sec, turma.id, { nome: 'Estudante ana Teste', email: 'ana@esgfaa.gov.ao' })
    const cadeira = (await sec.post(`/api/admin/academico/turmas/${turma.id}/cadeiras`).send({ codigo: 'DEF101', nome: 'Defesa' })).body
    await sec.put(`/api/admin/academico/cadeiras/${cadeira.id}/docentes`).send({ docentes: [{ docenteId: prof.id, papel: 'regente' }] })
    for (const k of ['prof', 'ana']) {
      const email = `${k}@esgfaa.gov.ao`
      const r = await amb.http().post('/api/portal/entrar').send({ email, senha: amb.senhaInicial(email) })
      tokens[k] = (await amb.com(r.body.token).put('/api/portal/eu/senha').send({ atual: amb.senhaInicial(email), nova: NOVA })).body.token
    }
    trabalho = (await portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/trabalhos`).send({ titulo: 'Defesa territorial', prazo: '2026-11-20T23:59:00Z' })).body
  })
  after(() => amb.fechar())

  it('encontra a página copiada da internet e junta a avaliação de IA ao relatório', async () => {
    const e = await portal('ana').post(`/api/portal/trabalhos/${trabalho.id}/entrega`).attach('ficheiro', docxComTexto(`${SITE}\n\n${PROPRIO}`), { filename: 'ana.docx', contentType: DOCX })
    assert.equal(e.status, 201, e.body.erro)
    await amb.contentor.servicos.integridade.esvaziar()
    assert.ok(pesquisas.length >= 2 && pesquisas.length <= 8)

    const estado = (await portal('prof').get(`/api/portal/trabalhos/${trabalho.id}/integridade`)).body[e.body.id]
    assert.equal(estado.estado, 'concluida')
    assert.ok(estado.percentagem > 40 && estado.percentagem < 75, String(estado.percentagem))
    assert.equal(estado.iaPontuacao, 72)

    const r = (await portal('prof').get(`/api/portal/integridade/${estado.id}`)).body
    assert.deepEqual(r.fontes.map((f) => [f.origem, f.url, f.titulo]), [['internet', 'https://defesa.exemplo.ao/doutrina', 'Doutrina de defesa territorial']])
    assert.equal(r.internet.estado, 'feita')
    assert.equal(r.internet.paginas, 2)
    assert.match(r.trechos[0].excerto, /^doutrina de defesa territorial/i)
    // IA: o Claude recebeu os parágrafos numerados; o parágrafo inexistente (9) foi ignorado
    assert.match(pedidosClaude[0], /^\[1\] A doutrina/)
    assert.equal(r.ia.claude.probabilidade, 72)
    assert.equal(r.ia.claude.paragrafos.length, 1)
    assert.equal(r.texto.slice(r.ia.claude.paragrafos[0].inicio, r.ia.claude.paragrafos[0].fim).slice(0, 11), 'A doutrina ')
    assert.equal(r.ia.local.pontuacao, null) // texto curto demais para os indicadores locais (menos de 80 palavras)
  })
})
