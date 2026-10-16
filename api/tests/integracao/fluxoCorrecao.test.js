import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente, relogioFalso } from '../apoio/ambiente.js'

const NOVA = 'Portal2026segura'
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n')
const anexo = (nome) => [PDF, { filename: nome, contentType: 'application/pdf' }]

describe('fluxo de correção: correção anónima e notas libertadas todas de uma vez', () => {
  let amb, cadeira
  const contas = {}
  const tokens = {}
  const portal = (quem) => amb.com(tokens[quem])
  const notificacoes = async (quem) => { const n = (await portal(quem).get('/api/portal/notificacoes')).body; return n.lista || n }
  const trabalhoDe = async (quem, id) => (await portal(quem).get(`/api/portal/cadeiras/${cadeira.id}`)).body.trabalhos.find((t) => t.id === id)

  before(async () => {
    amb = await criarAmbiente({ relogio: relogioFalso('2026-11-09T09:00:00Z') })
    const admin = await amb.entrar()
    await amb.com(admin).post('/api/admin/colecoes/cursos').send({ nome: 'Curso de Estado-Maior' })
    const s = await amb.criarUtilizador('administrador')
    const sec = () => amb.com(s.token)
    const turma = (await sec().post('/api/admin/academico/turmas').send({ curso: 'curso-de-estado-maior', anoLetivo: '2026/2027', nome: 'CEM A' })).body
    contas.prof = (await sec().post('/api/admin/academico/contas').send({ tipo: 'docente', nome: 'Docente Prof Teste', email: 'prof@esgfaa.gov.ao' })).body
    for (const k of ['ana', 'bruno']) contas[k] = (await amb.registarEMatricular(sec(), turma.id, { nome: `Estudante ${k} Teste`, email: `${k}@esgfaa.gov.ao` })).body
    cadeira = (await sec().post(`/api/admin/academico/turmas/${turma.id}/cadeiras`).send({ codigo: 'EST101', nome: 'Estratégia' })).body
    await sec().put(`/api/admin/academico/cadeiras/${cadeira.id}/docentes`).send({ docentes: [{ docenteId: contas.prof.id, papel: 'regente' }] })
    for (const k of ['prof', 'ana', 'bruno']) {
      const email = `${k}@esgfaa.gov.ao`
      const r = await amb.http().post('/api/portal/entrar').send({ email, senha: email })
      tokens[k] = (await amb.com(r.body.token).put('/api/portal/eu/senha').send({ atual: email, nova: NOVA })).body.token
    }
  })
  after(() => amb.fechar())

  it('anónima: o docente corrige sem nomes; o estudante só vê a nota (e o ficheiro corrigido) quando forem libertadas', async () => {
    const t = (await portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/trabalhos`).send({ titulo: 'Ensaio anónimo', prazo: '2026-11-20T23:59:00Z', anonimo: true })).body
    assert.deepEqual([t.anonimo, t.notasOcultas], [true, true])
    assert.equal((await portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/trabalhos`).send({ titulo: 'Grupo', prazo: '2026-11-20T23:59:00Z', anonimo: true, emGrupo: true })).status, 400)
    await portal('prof').put(`/api/portal/cadeiras/${cadeira.id}/pauta/composicao`).send({ componente: 'p1', itens: [{ tipo: 'trabalho', id: t.id, peso: 100 }] })

    const e = (await portal('ana').post(`/api/portal/trabalhos/${t.id}/entrega`).attach('ficheiro', ...anexo('ensaio.pdf'))).body
    const lista = (await portal('prof').get(`/api/portal/trabalhos/${t.id}/entregas`)).body
    assert.equal(lista.anonimo, true)
    assert.ok(lista.linhas.every((l) => /^Participante \d$/.test(l.estudante.nome) && !l.entrega?.estudante))
    assert.ok(!JSON.stringify(lista).includes('Estudante ana Teste'))

    const c = await portal('prof').put(`/api/portal/entregas/${e.id}`).field('nota', '16').field('correcao', 'Bom trabalho.').attach('ficheiro', ...anexo('corrigido.pdf'))
    assert.equal(c.status, 200, c.body.erro)
    // antes de libertar: nada chega à Ana
    let meu = await trabalhoDe('ana', t.id)
    assert.equal(meu.aguardaNotas, true)
    assert.deepEqual([meu.entrega.nota, meu.entrega.correcao, meu.entrega.correcaoFicheiroId], [null, '', null])
    assert.equal((await portal('ana').get(`/api/portal/ficheiros/${c.body.correcaoFicheiroId}`)).status, 404)
    assert.ok(!(await notificacoes('ana')).some((n) => n.tipo === 'correcao'))
    const pauta = (await portal('prof').get(`/api/portal/cadeiras/${cadeira.id}/pauta`)).body
    assert.equal(pauta.linhas.find((l) => l.estudante.id === contas.ana.id).p1, null)

    // só o docente da cadeira liberta, e uma vez
    assert.equal((await portal('ana').post(`/api/portal/trabalhos/${t.id}/libertar-notas`)).status, 403)
    const l = await portal('prof').post(`/api/portal/trabalhos/${t.id}/libertar-notas`)
    assert.equal(l.status, 200, l.body.erro)
    assert.equal(l.body.corrigidas, 1)
    assert.equal((await portal('prof').post(`/api/portal/trabalhos/${t.id}/libertar-notas`)).status, 409)

    meu = await trabalhoDe('ana', t.id)
    assert.deepEqual([meu.aguardaNotas, meu.entrega.nota, meu.entrega.correcao], [false, 16, 'Bom trabalho.'])
    assert.equal((await portal('ana').get(`/api/portal/ficheiros/${c.body.correcaoFicheiroId}`)).status, 200)
    assert.ok((await notificacoes('ana')).some((n) => n.tipo === 'correcao' && /Notas publicadas/.test(n.titulo)))
    assert.equal((await portal('prof').get(`/api/portal/cadeiras/${cadeira.id}/pauta`)).body.linhas.find((x) => x.estudante.id === contas.ana.id).p1, 16)
    // e os nomes voltam a aparecer
    assert.ok((await portal('prof').get(`/api/portal/trabalhos/${t.id}/entregas`)).body.linhas.some((x) => x.estudante.nome === 'Estudante ana Teste'))
  })

  it('só notas ocultas (sem anonimato): o docente vê os nomes, o estudante espera pela publicação', async () => {
    const t = (await portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/trabalhos`).send({ titulo: 'Relatório', prazo: '2026-11-20T23:59:00Z', notasOcultas: true })).body
    const e = (await portal('bruno').post(`/api/portal/trabalhos/${t.id}/entrega`).attach('ficheiro', ...anexo('r.pdf'))).body
    const lista = (await portal('prof').get(`/api/portal/trabalhos/${t.id}/entregas`)).body
    assert.equal(lista.anonimo, false)
    assert.ok(lista.linhas.some((x) => x.estudante.nome === 'Estudante bruno Teste'))
    await portal('prof').put(`/api/portal/entregas/${e.id}`).send({ nota: 12 })
    assert.equal((await trabalhoDe('bruno', t.id)).entrega.nota, null)
    await portal('prof').post(`/api/portal/trabalhos/${t.id}/libertar-notas`)
    assert.equal((await trabalhoDe('bruno', t.id)).entrega.nota, 12)
  })
})
