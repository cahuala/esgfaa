import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente, relogioFalso } from '../apoio/ambiente.js'

const NOVA = 'Portal2026segura'

describe('glossário e wiki da cadeira', () => {
  let amb, cadeira
  const contas = {}
  const tokens = {}
  const portal = (quem) => amb.com(tokens[quem])

  before(async () => {
    amb = await criarAmbiente({ relogio: relogioFalso('2026-11-09T09:00:00Z') })
    const admin = await amb.entrar()
    await amb.com(admin).post('/api/admin/colecoes/cursos').send({ nome: 'Curso de Estado-Maior' })
    const s = await amb.criarUtilizador('secretaria')
    const sec = () => amb.com(s.token)
    const turma = (await sec().post('/api/admin/academico/turmas').send({ curso: 'curso-de-estado-maior', anoLetivo: '2026/2027', nome: 'CEM A' })).body
    const outra = (await sec().post('/api/admin/academico/turmas').send({ curso: 'curso-de-estado-maior', anoLetivo: '2026/2027', nome: 'CEM B' })).body
    contas.prof = (await sec().post('/api/admin/academico/contas').send({ tipo: 'docente', nome: 'Docente Prof Teste', email: 'prof@esgfaa.gov.ao' })).body
    for (const k of ['ana', 'bruno']) contas[k] = (await sec().post(`/api/admin/academico/turmas/${turma.id}/matricula-nova`).send({ nome: `Estudante ${k} Teste`, email: `${k}@esgfaa.gov.ao` })).body
    contas.zeca = (await sec().post(`/api/admin/academico/turmas/${outra.id}/matricula-nova`).send({ nome: 'Estudante zeca Teste', email: 'zeca@esgfaa.gov.ao' })).body
    cadeira = (await sec().post(`/api/admin/academico/turmas/${turma.id}/cadeiras`).send({ codigo: 'EST101', nome: 'Estratégia' })).body
    await sec().put(`/api/admin/academico/cadeiras/${cadeira.id}/docentes`).send({ docentes: [{ docenteId: contas.prof.id, papel: 'regente' }] })
    for (const k of ['prof', 'ana', 'bruno', 'zeca']) {
      const email = `${k}@esgfaa.gov.ao`
      const r = await amb.http().post('/api/portal/entrar').send({ email, senha: email })
      tokens[k] = (await amb.com(r.body.token).put('/api/portal/eu/senha').send({ atual: email, nova: NOVA })).body.token
    }
  })
  after(() => amb.fechar())

  it('glossário: o estudante propõe, o docente aprova; sem termos repetidos; ordem alfabética', async () => {
    const g = (quem, corpo) => portal(quem).post(`/api/portal/cadeiras/${cadeira.id}/glossario`).send(corpo)
    const doc = (await g('prof', { termo: 'Estratégia', definicao: 'Arte de empregar os meios para atingir os fins políticos.' })).body
    assert.equal(doc.aprovado, true)
    const prop = (await g('ana', { termo: 'Centro de gravidade', definicao: 'Fonte de poder de onde o adversário tira liberdade de ação.' })).body
    assert.equal(prop.aprovado, false)
    assert.equal((await g('bruno', { termo: 'estratégia', definicao: 'Repetido em minúsculas.' })).status, 409)
    // o colega não vê o termo por aprovar; a autora e o docente veem
    const lista = async (quem, q = '') => (await portal(quem).get(`/api/portal/cadeiras/${cadeira.id}/glossario${q ? `?q=${encodeURIComponent(q)}` : ''}`)).body.map((t) => t.termo)
    assert.deepEqual(await lista('bruno'), ['Estratégia'])
    assert.deepEqual(await lista('ana'), ['Centro de gravidade', 'Estratégia'])
    assert.equal((await portal('bruno').put(`/api/portal/glossario/${prop.id}`).send({ aprovado: true })).status, 403)
    assert.equal((await portal('ana').put(`/api/portal/glossario/${prop.id}`).send({ aprovado: true })).status, 403)
    assert.equal((await portal('prof').put(`/api/portal/glossario/${prop.id}`).send({ aprovado: true })).body.aprovado, true)
    assert.deepEqual(await lista('bruno'), ['Centro de gravidade', 'Estratégia'])
    assert.deepEqual(await lista('bruno', 'adversário'), ['Centro de gravidade'])
    // aprovado: a autora já não muda nem apaga; o docente sim
    assert.equal((await portal('ana').delete(`/api/portal/glossario/${prop.id}`)).status, 403)
    assert.equal((await portal('zeca').get(`/api/portal/cadeiras/${cadeira.id}/glossario`)).status, 404)
  })

  it('wiki: páginas, versões, conflito de edição, reposição pelo docente', async () => {
    const p = await portal('ana').post(`/api/portal/cadeiras/${cadeira.id}/wiki`).send({ titulo: 'Página inicial', conteudo: '<p>Resumos da turma.</p><script>x()</script>' })
    assert.equal(p.status, 201, p.body.erro)
    assert.equal(p.body.versoes[0].conteudo, '<p>Resumos da turma.</p>')
    assert.equal((await portal('bruno').post(`/api/portal/cadeiras/${cadeira.id}/wiki`).send({ titulo: 'Página inicial', conteudo: '<p>x</p>' })).status, 409)
    let v = (await portal('bruno').get(`/api/portal/wiki/${p.body.id}`)).body
    const base = v.atual
    v = (await portal('bruno').put(`/api/portal/wiki/${p.body.id}`).send({ conteudo: '<p>Resumos da turma. Capítulo 1: Clausewitz.</p>', base, resumo: 'Capítulo 1' })).body
    assert.equal(v.versoes.length, 2)
    assert.equal(v.versao.conteudo, '<p>Resumos da turma. Capítulo 1: Clausewitz.</p>')
    assert.equal(v.versoes[0].conteudo, undefined) // a lista não traz o conteúdo
    // a Ana editava a versão antiga: conflito
    const c = await portal('ana').put(`/api/portal/wiki/${p.body.id}`).send({ conteudo: '<p>Outra coisa</p>', base })
    assert.equal(c.status, 409)
    // ver uma versão antiga e repor (só o docente)
    const antiga = v.versoes[1].id
    assert.equal((await portal('ana').get(`/api/portal/wiki/${p.body.id}?versao=${antiga}`)).body.versao.conteudo, '<p>Resumos da turma.</p>')
    assert.equal((await portal('ana').post(`/api/portal/wiki/${p.body.id}/restaurar`).send({ versaoId: antiga })).status, 403)
    v = (await portal('prof').post(`/api/portal/wiki/${p.body.id}/restaurar`).send({ versaoId: antiga })).body
    assert.deepEqual([v.versoes.length, v.versao.conteudo], [3, '<p>Resumos da turma.</p>'])
    const paginas = (await portal('ana').get(`/api/portal/cadeiras/${cadeira.id}/wiki`)).body
    assert.deepEqual(paginas.map((x) => [x.titulo, x.versoes, x.ultimoAutor.nome]), [['Página inicial', 3, 'Docente Prof Teste']])
    assert.equal((await portal('ana').delete(`/api/portal/wiki/${p.body.id}`)).status, 403)
    assert.equal((await portal('zeca').get(`/api/portal/wiki/${p.body.id}`)).status, 404)
    assert.equal((await portal('prof').delete(`/api/portal/wiki/${p.body.id}`)).status, 204)
  })
})
