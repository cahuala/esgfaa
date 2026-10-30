import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { zipSync } from 'fflate'
import { criarAmbiente } from '../apoio/ambiente.js'

const NOVA = 'Portal2026segura'
const enc = (s) => new TextEncoder().encode(s)
const zip = (o) => Buffer.from(zipSync(Object.fromEntries(Object.entries(o).map(([k, v]) => [k, enc(v)]))))
const SCORM = zip({
  'imsmanifest.xml': `<?xml version="1.0"?><manifest identifier="m" xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2" xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2">
    <metadata><schema>ADL SCORM</schema><schemaversion>1.2</schemaversion></metadata>
    <organizations default="org"><organization identifier="org"><title>Curso de mapas</title><item identifier="i1" identifierref="r1"><title>Aula 1</title></item></organization></organizations>
    <resources><resource identifier="r1" type="webcontent" adlcp:scormtype="sco" href="aula/index.html"><file href="aula/index.html"/></resource></resources></manifest>`,
  'aula/index.html': '<html><body><h1>Leitura de mapas</h1><script src="sco.js"></script></body></html>',
  'aula/sco.js': 'window.parent.API.LMSInitialize("")',
})
const H5P = zip({
  'h5p.json': JSON.stringify({ title: 'Teste rápido', mainLibrary: 'H5P.MultiChoice', preloadedDependencies: [{ machineName: 'H5P.MultiChoice', majorVersion: 1, minorVersion: 16 }] }),
  'content/content.json': JSON.stringify({ question: '<p>2 + 2?</p>', answers: [{ text: '4', correct: true }, { text: '5', correct: false }] }),
  'H5P.MultiChoice-1.16/library.json': JSON.stringify({ machineName: 'H5P.MultiChoice', majorVersion: 1, minorVersion: 16 }),
})

describe('conteúdos interativos: pacotes SCORM e H5P', () => {
  let amb, cadeira
  const tokens = {}
  const contas = {}
  const como = (quem) => amb.com(tokens[quem])
  const carregar = (tipo, dados, nome) => como('prof').post(`/api/portal/cadeiras/${cadeira.id}/materiais`).field('tipo', tipo).field('titulo', `Conteúdo ${tipo}`).attach('ficheiro', dados, { filename: nome, contentType: 'application/zip' })
  const caminho = (url) => new URL(url).pathname

  before(async () => {
    amb = await criarAmbiente()
    const admin = await amb.entrar()
    await amb.com(admin).post('/api/admin/colecoes/cursos').send({ nome: 'Curso de Estado-Maior' })
    const s = await amb.criarUtilizador('administrador')
    const sec = () => amb.com(s.token)
    const turma = (await sec().post('/api/admin/academico/turmas').send({ curso: 'curso-de-estado-maior', anoLetivo: '2026/2027', nome: 'CEM A' })).body
    const outra = (await sec().post('/api/admin/academico/turmas').send({ curso: 'curso-de-estado-maior', anoLetivo: '2026/2027', nome: 'CEM B' })).body
    contas.prof = (await sec().post('/api/admin/academico/contas').send({ tipo: 'docente', nome: 'Docente Prof Teste', email: 'prof@esgfaa.gov.ao' })).body
    contas.ana = (await amb.registarEMatricular(sec(), turma.id, { nome: 'Estudante ana Teste', email: 'ana@esgfaa.gov.ao' })).body
    contas.carla = (await amb.registarEMatricular(sec(), outra.id, { nome: 'Estudante carla Teste', email: 'carla@esgfaa.gov.ao' })).body
    cadeira = (await sec().post(`/api/admin/academico/turmas/${turma.id}/cadeiras`).send({ codigo: 'EST101', nome: 'Estratégia' })).body
    await sec().put(`/api/admin/academico/cadeiras/${cadeira.id}/docentes`).send({ docentes: [{ docenteId: contas.prof.id, papel: 'regente' }] })
    for (const k of ['prof', 'ana', 'carla']) {
      const email = `${k}@esgfaa.gov.ao`
      const r = await amb.http().post('/api/portal/entrar').send({ email, senha: amb.senhaInicial(email) })
      tokens[k] = (await amb.com(r.body.token).put('/api/portal/eu/senha').send({ atual: amb.senhaInicial(email), nova: NOVA })).body.token
    }
  })
  after(() => amb.fechar())

  it('SCORM: carrega, abre no leitor, serve os ficheiros e guarda o estado e a nota do estudante', async () => {
    const m = await carregar('scorm', SCORM, 'mapas.zip')
    assert.equal(m.status, 201, m.body.erro)
    assert.deepEqual([m.body.estrutura.versao, m.body.estrutura.inicio], ['1.2', 'aula/index.html'])
    const a = await como('ana').post(`/api/portal/materiais/${m.body.id}/pacote`)
    assert.equal(a.status, 200, a.body.erro)
    const base = caminho(a.body.url).replace(/\/__leitor$/, '')
    const leitor = await amb.http().get(`${base}/__leitor`)
    assert.equal(leitor.status, 200)
    assert.match(leitor.text, /window\.API = s12/)
    assert.match(leitor.headers['content-security-policy'], /frame-ancestors/)
    assert.equal(leitor.headers['x-frame-options'], undefined)
    assert.match((await amb.http().get(`${base}/aula/index.html`)).text, /Leitura de mapas/)
    assert.match((await amb.http().get(`${base}/aula/sco.js`)).headers['content-type'], /javascript/)
    assert.equal((await amb.http().get(`${base}/..%2F..%2Fpackage.json`)).status, 404)
    assert.equal((await amb.http().get(`${base}/aula/nao-existe.html`)).status, 404)

    const g = await amb.http().post(`${base}/__estado`).send({ estado: 'aprovado', nota: 16, dados: { 'cmi.core.lesson_status': 'passed', 'cmi.suspend_data': 'pag=3' }, tempoSegundos: 120 })
    assert.deepEqual([g.status, g.body.estado, g.body.nota], [200, 'aprovado', 16])
    // depois de aprovado não volta atrás; os dados ficam para retomar
    await amb.http().post(`${base}/__estado`).send({ estado: 'iniciado' })
    assert.match((await amb.http().get(`${base}/__leitor`)).text, /pag=3/)
    const r = (await como('prof').get(`/api/portal/materiais/${m.body.id}/pacote/resultados`)).body
    const linha = r.linhas.find((l) => l.estudante.id === contas.ana.id)
    assert.deepEqual([linha.estado, linha.nota, linha.tempoSegundos], ['aprovado', 16, 120])
    // conta para o progresso da cadeira
    const p = (await como('ana').get(`/api/portal/cadeiras/${cadeira.id}/progresso`)).body
    assert.ok(p.itens.find((i) => i.tipo === 'material' && i.id === m.body.id).feita)
    assert.equal((await como('ana').put(`/api/portal/materiais/${m.body.id}/conclusao`).send({ concluido: false })).status, 409)
  })

  it('H5P: carrega com as bibliotecas, abre o leitor H5P e regista a nota', async () => {
    const m = await carregar('h5p', H5P, 'teste.h5p')
    assert.equal(m.status, 201, m.body.erro)
    const a = (await como('ana').post(`/api/portal/materiais/${m.body.id}/pacote`)).body
    const base = caminho(a.url).replace(/\/__leitor$/, '')
    const leitor = await amb.http().get(`${base}/__leitor`)
    assert.match(leitor.text, /H5PStandalone/)
    assert.equal((await amb.http().get('/api/pacotes/__h5p/main.bundle.js')).status, 200)
    assert.match((await amb.http().get(`${base}/h5p.json`)).text, /Teste rápido/)
    assert.equal((await amb.http().post(`${base}/__estado`).send({ estado: 'concluido', nota: 20 })).body.nota, 20)
  })

  it('recusa: pacotes inválidos, quem não é da cadeira, endereços inventados, e o docente não conta como estudante', async () => {
    assert.equal((await carregar('scorm', zip({ 'index.html': '<p>x</p>' }), 'x.zip')).status, 400) // sem imsmanifest.xml
    assert.equal((await carregar('h5p', zip({ 'h5p.json': '{"title":"x","mainLibrary":"H5P.X","preloadedDependencies":[{"machineName":"H5P.X","majorVersion":1,"minorVersion":0}]}', 'content/content.json': '{}' }), 'x.h5p')).status, 400) // sem bibliotecas
    const m = (await carregar('scorm', SCORM, 'mapas.zip')).body
    assert.ok([403, 404].includes((await como('carla').post(`/api/portal/materiais/${m.id}/pacote`)).status))
    assert.equal((await amb.http().get('/api/pacotes/eyJhbGciOiJIUzI1NiJ9.eyJtIjoxLCJjIjoxfQ.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx/__leitor')).status, 404)
    const d = (await como('prof').post(`/api/portal/materiais/${m.id}/pacote`)).body
    const base = caminho(d.url).replace(/\/__leitor$/, '')
    assert.equal((await amb.http().post(`${base}/__estado`).send({ estado: 'aprovado', nota: 20 })).body.guardado, false)
    assert.equal((await amb.http().post(`${base}/__estado`).send({ nota: 50 })).status, 400)
  })
})
