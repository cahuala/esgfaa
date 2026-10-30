import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente, relogioFalso } from '../apoio/ambiente.js'
import { DOCX, docxComTexto, pdfComTexto } from '../apoio/documentos.js'

const NOVA = 'Portal2026segura'
const ANA = 'A logistica militar compreende o planeamento e a execucao do movimento e da manutencao das forcas em campanha. Nas operacoes conjuntas o apoio logistico deve ser coordenado entre os ramos para evitar duplicacoes e garantir a sustentacao do esforco principal. A cadeia de reabastecimento depende de rotas seguras, de depositos avancados e de meios de transporte adequados ao teatro. Sem informacao fiavel sobre consumos e existencias nenhum comandante consegue antecipar necessidades nem decidir onde concentrar os recursos disponiveis.'
const PROPRIO = 'O estudo da geopolitica do Atlantico Sul exige compreender as rotas maritimas, os recursos energeticos e a presenca de potencias externas na regiao. A cooperacao entre os Estados ribeirinhos tem crescido com exercicios navais conjuntos, partilha de informacao e acordos de vigilancia das zonas economicas exclusivas, mas continua limitada pela falta de meios.'
const REFERENCIA = 'A guerra irregular caracteriza-se pela assimetria entre os contendores, pelo recurso a emboscadas e sabotagem e pela procura do apoio da populacao. Os manuais classicos recomendam a combinacao de accao militar, desenvolvimento economico e boa governacao para isolar os insurgentes das suas bases de apoio e recuperar a confianca das comunidades locais afectadas pelo conflito.'
const anexo = (b, nome, tipo = 'application/pdf') => [b, { filename: nome, contentType: tipo }]

describe('integridade académica (anti-plágio)', () => {
  let amb, cadeira, trabalho, escola
  const contas = {}
  const tokens = {}
  const portal = (quem) => amb.com(tokens[quem])
  const esperar = () => amb.contentor.servicos.integridade.esvaziar()

  before(async () => {
    amb = await criarAmbiente({ relogio: relogioFalso('2026-11-09T09:00:00Z') })
    const admin = await amb.entrar()
    await amb.com(admin).post('/api/admin/colecoes/cursos').send({ nome: 'Curso de Estado-Maior' })
    const s = await amb.criarUtilizador('administrador')
    const sec = () => amb.com(s.token)
    escola = amb.com((await amb.criarUtilizador('secretaria')).token)
    const turma = (await sec().post('/api/admin/academico/turmas').send({ curso: 'curso-de-estado-maior', anoLetivo: '2026/2027', nome: 'CEM A' })).body
    for (const k of ['prof', 'outro']) contas[k] = (await sec().post('/api/admin/academico/contas').send({ tipo: 'docente', nome: `Docente ${k} Teste`, email: `${k}@esgfaa.gov.ao` })).body
    for (const k of ['ana', 'bruno', 'carla']) contas[k] = (await amb.registarEMatricular(sec(), turma.id, { nome: `Estudante ${k} Teste`, email: `${k}@esgfaa.gov.ao` })).body
    cadeira = (await sec().post(`/api/admin/academico/turmas/${turma.id}/cadeiras`).send({ codigo: 'LOG201', nome: 'Logística' })).body
    await sec().put(`/api/admin/academico/cadeiras/${cadeira.id}/docentes`).send({ docentes: [{ docenteId: contas.prof.id, papel: 'regente' }] })
    for (const k of ['prof', 'outro', 'ana', 'bruno', 'carla']) {
      const email = `${k}@esgfaa.gov.ao`
      const r = await amb.http().post('/api/portal/entrar').send({ email, senha: amb.senhaInicial(email) })
      tokens[k] = (await amb.com(r.body.token).put('/api/portal/eu/senha').send({ atual: amb.senhaInicial(email), nova: NOVA })).body.token
    }
    trabalho = (await portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/trabalhos`).send({ titulo: 'Ensaio de logística', prazo: '2026-11-20T23:59:00Z' })).body
  })
  after(() => amb.fechar())

  it('cada entrega é comparada com as outras: a cópia aparece, com a fonte e os trechos', async () => {
    const a = await portal('ana').post(`/api/portal/trabalhos/${trabalho.id}/entrega`).attach('ficheiro', ...anexo(pdfComTexto(`${ANA} ${PROPRIO}`), 'ana.pdf'))
    assert.equal(a.status, 201, a.body.erro)
    await esperar()
    // o Bruno copia metade do trabalho da Ana, num Word
    const b = await portal('bruno').post(`/api/portal/trabalhos/${trabalho.id}/entrega`).attach('ficheiro', ...anexo(docxComTexto(`${REFERENCIA} ${ANA}`), 'bruno.docx', DOCX))
    assert.equal(b.status, 201, b.body.erro)
    // a Carla entrega um ficheiro sem texto legível
    await portal('carla').post(`/api/portal/trabalhos/${trabalho.id}/entrega`).attach('ficheiro', ...anexo(Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n'), 'scan.pdf'))
    await esperar()

    const estado = (await portal('prof').get(`/api/portal/trabalhos/${trabalho.id}/integridade`)).body
    const ana = estado[a.body.id]
    const bruno = estado[b.body.id]
    assert.deepEqual([ana.estado, ana.percentagem], ['concluida', 0])
    assert.equal(bruno.estado, 'concluida')
    assert.ok(bruno.percentagem > 45 && bruno.percentagem < 65, String(bruno.percentagem))
    assert.equal(bruno.nivel.nivel, 'alto')
    const carla = Object.values(estado).find((x) => x.estado === 'erro')
    assert.match(carla.erro, /ler texto/)

    const r = (await portal('prof').get(`/api/portal/integridade/${bruno.id}`)).body
    assert.equal(r.documento.autor, 'Estudante bruno Teste')
    assert.deepEqual(r.fontes.map((f) => [f.autor, f.origem]), [['Estudante ana Teste', 'entrega']])
    assert.equal(r.trechos.length, 1)
    assert.match(r.texto.slice(r.trechos[0].inicio, r.trechos[0].fim), /^logistica militar compreende [\s\S]* recursos disponiveis$/)
    assert.match(r.trechos[0].excerto, /^logistica militar compreende/)

    // depois da cópia, a Ana pede nova análise ao docente: agora aparece o Bruno como fonte
    assert.equal((await portal('prof').post(`/api/portal/entregas/${a.body.id}/integridade`)).status, 202)
    await esperar()
    const ana2 = (await portal('prof').get(`/api/portal/trabalhos/${trabalho.id}/integridade`)).body[a.body.id]
    assert.ok(ana2.percentagem > 40, String(ana2.percentagem))

    // só o docente da cadeira; os estudantes nunca
    assert.equal((await portal('outro').get(`/api/portal/integridade/${bruno.id}`)).status, 404)
    assert.equal((await portal('outro').get(`/api/portal/trabalhos/${trabalho.id}/integridade`)).status, 404)
    assert.equal((await portal('bruno').get(`/api/portal/integridade/${bruno.id}`)).status, 403)
    assert.equal((await portal('bruno').get('/api/portal/integridade')).status, 403)
  })

  it('repositório de referência e verificação avulsa (docente e Administração Escolar)', async () => {
    // documento de referência carregado pela escola
    const ref = await escola.post('/api/admin/integridade/repositorio').field('titulo', 'Manual de guerra irregular').field('autor', 'Escola').attach('ficheiro', ...anexo(pdfComTexto(REFERENCIA), 'manual.pdf'))
    assert.equal(ref.status, 201, ref.body.erro)
    assert.equal((await escola.post('/api/admin/integridade/repositorio').attach('ficheiro', ...anexo(Buffer.from('%PDF-1.4\n%%EOF\n'), 'vazio.pdf'))).status, 400)

    // o docente verifica um texto à parte (não fica guardado como fonte)
    const v = await portal('prof').post('/api/portal/integridade').field('titulo', 'Proposta de TFC').attach('ficheiro', ...anexo(docxComTexto(`${PROPRIO} ${REFERENCIA}`), 'tfc.docx', DOCX))
    assert.equal(v.status, 201, v.body.erro)
    await esperar()
    const minhas = (await portal('prof').get('/api/portal/integridade')).body
    assert.equal(minhas.length, 1)
    const rel = (await portal('prof').get(`/api/portal/integridade/${minhas[0].id}`)).body
    assert.ok(rel.percentagem > 90, String(rel.percentagem))
    // um parágrafo vem da Ana; o outro está no manual de referência e no trabalho do Bruno (conta a fonte com mais texto)
    assert.deepEqual(rel.fontes.map((f) => f.origem).sort(), ['entrega', 'entrega', 'repositorio'])
    // outro docente não vê a verificação do colega
    assert.equal((await portal('outro').get(`/api/portal/integridade/${minhas[0].id}`)).status, 404)

    // a escola vê tudo, verifica e gere o repositório
    const resumo = (await escola.get('/api/admin/integridade')).body
    assert.ok(resumo.analises.length >= 5)
    assert.equal(resumo.fontes.repositorio, 1)
    const painel = (await escola.get(`/api/admin/integridade/analises/${minhas[0].id}`)).body
    assert.equal(painel.documento.titulo, 'Proposta de TFC')
    assert.equal((await escola.get('/api/admin/integridade/repositorio')).body.length, 1)
    assert.equal((await escola.delete(`/api/admin/integridade/documentos/${ref.body.id}`)).status, 204)
    assert.equal((await escola.post('/api/admin/integridade/reindexar')).status, 202)
    await esperar()
    // quem não tem a permissão não entra
    const bib = amb.com((await amb.criarUtilizador('bibliotecario')).token)
    assert.equal((await bib.get('/api/admin/integridade')).status, 403)
  })
})
