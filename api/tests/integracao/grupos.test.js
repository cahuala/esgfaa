import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente, relogioFalso } from '../apoio/ambiente.js'
import { distribuir } from '../../src/aplicacao/portal/grupos.js'

const NOVA = 'Portal2026segura'
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n')
const anexo = (nome) => [PDF, { filename: nome, contentType: 'application/pdf' }]
const NOMES = ['ana', 'bruno', 'carla', 'dino', 'eva']

describe('grupos e trabalhos em grupo', () => {
  let amb, relogio, cadeira, A, B
  const contas = {}
  const tokens = {}
  const portal = (quem) => amb.com(tokens[quem])

  before(async () => {
    relogio = relogioFalso('2026-11-09T09:00:00Z')
    amb = await criarAmbiente({ relogio })
    const admin = await amb.entrar()
    await amb.com(admin).post('/api/admin/colecoes/cursos').send({ nome: 'Curso de Estado-Maior' })
    const s = await amb.criarUtilizador('secretaria')
    const sec = () => amb.com(s.token)
    const turma = (await sec().post('/api/admin/academico/turmas').send({ curso: 'curso-de-estado-maior', anoLetivo: '2026/2027', nome: 'CEM A' })).body
    contas.prof = (await sec().post('/api/admin/academico/contas').send({ tipo: 'docente', nome: 'Docente Prof Teste', email: 'prof@esgfaa.gov.ao' })).body
    for (const k of NOMES) contas[k] = (await sec().post(`/api/admin/academico/turmas/${turma.id}/matricula-nova`).send({ nome: `Estudante ${k} Teste`, email: `${k}@esgfaa.gov.ao` })).body
    cadeira = (await sec().post(`/api/admin/academico/turmas/${turma.id}/cadeiras`).send({ codigo: 'EST101', nome: 'Estratégia' })).body
    await sec().put(`/api/admin/academico/cadeiras/${cadeira.id}/docentes`).send({ docentes: [{ docenteId: contas.prof.id, papel: 'regente' }] })
    for (const k of ['prof', ...NOMES]) {
      const email = `${k}@esgfaa.gov.ao`
      const r = await amb.http().post('/api/portal/entrar').send({ email, senha: email })
      tokens[k] = (await amb.com(r.body.token).put('/api/portal/eu/senha').send({ atual: email, nova: NOVA })).body.token
    }
  })
  after(() => amb.fechar())

  it('distribuição ao acaso: por tamanho e por número', () => {
    const ids = [1, 2, 3, 4, 5, 6, 7]
    const porTamanho = distribuir(ids, 'tamanho', 3, () => 0.5)
    assert.deepEqual(porTamanho.map((g) => g.length).sort(), [3, 4])
    const porNumero = distribuir(ids, 'numero', 3, () => 0.5)
    assert.deepEqual(porNumero.map((g) => g.length).sort(), [2, 2, 3])
    assert.deepEqual(porNumero.flat().sort(), ids)
    assert.deepEqual(distribuir([], 'numero', 3), [])
  })

  it('o docente cria grupos; cada estudante fica num só grupo da cadeira', async () => {
    assert.equal((await portal('ana').post(`/api/portal/cadeiras/${cadeira.id}/grupos`).send({ nome: 'X' })).status, 403)
    A = (await portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/grupos`).send({ nome: 'Grupo A', membros: [contas.ana.id, contas.bruno.id] })).body
    assert.deepEqual(A.membros.map((m) => m.nome), ['Estudante ana Teste', 'Estudante bruno Teste'])
    assert.equal((await portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/grupos`).send({ nome: 'Grupo A' })).status, 409)
    // o Bruno muda para o grupo B: sai do A
    B = (await portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/grupos`).send({ nome: 'Grupo B', membros: [contas.bruno.id, contas.carla.id] })).body
    let l = (await portal('prof').get(`/api/portal/cadeiras/${cadeira.id}/grupos`)).body
    assert.deepEqual(l.grupos.map((g) => [g.nome, g.membros.length]), [['Grupo A', 1], ['Grupo B', 2]])
    assert.deepEqual(l.semGrupo.map((e) => e.nome).sort(), ['Estudante dino Teste', 'Estudante eva Teste'])
    A = (await portal('prof').put(`/api/portal/grupos/${A.id}`).send({ membros: [contas.ana.id, contas.dino.id] })).body
    assert.equal((await portal('prof').put(`/api/portal/grupos/${A.id}`).send({ membros: [999999] })).status, 400)
    // o estudante vê o seu grupo
    assert.equal((await portal('ana').get(`/api/portal/cadeiras/${cadeira.id}/grupos`)).body.meu.nome, 'Grupo A')
    assert.equal((await portal('eva').get(`/api/portal/cadeiras/${cadeira.id}/grupos`)).body.meu, null)
    // automático: a Eva (sem grupo) vai para um grupo novo
    l = (await portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/grupos/automatico`).send({ modo: 'tamanho', valor: 3 })).body
    assert.equal(l.semGrupo.length, 0)
    assert.deepEqual(l.grupos.map((g) => g.nome), ['Grupo 1', 'Grupo A', 'Grupo B'])
    assert.equal((await portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/grupos/automatico`).send({ modo: 'numero', valor: 2 })).status, 409)
  })

  it('trabalho em grupo: uma entrega do grupo, nota para todos, ficheiros só para o grupo', async () => {
    const t = (await portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/trabalhos`).send({ titulo: 'Estudo de caso', prazo: '2026-11-30T23:59:00Z', emGrupo: true })).body
    assert.equal(t.emGrupo, true)
    const e = await portal('ana').post(`/api/portal/trabalhos/${t.id}/entrega`).attach('ficheiro', ...anexo('caso-v1.pdf'))
    assert.equal(e.status, 201, e.body.erro)
    assert.equal(e.body.grupoId, A.id)
    // o colega de grupo vê a mesma entrega e pode substituí-la
    let v = (await portal('dino').get(`/api/portal/cadeiras/${cadeira.id}`)).body
    assert.equal(v.trabalhos.find((x) => x.id === t.id).entrega.ficheiros[0].nome, 'caso-v1.pdf')
    assert.equal(v.meuGrupo.nome, 'Grupo A')
    const f1 = e.body.ficheiros[0].id
    assert.equal((await portal('dino').get(`/api/portal/ficheiros/${f1}`)).status, 200)
    assert.equal((await portal('bruno').get(`/api/portal/ficheiros/${f1}`)).status, 404)
    const e2 = (await portal('dino').post(`/api/portal/trabalhos/${t.id}/entrega`).attach('ficheiro', ...anexo('caso-v2.pdf'))).body
    assert.equal(e2.id, e.body.id)
    // o grupo B ainda não entregou
    assert.equal((await portal('carla').get(`/api/portal/cadeiras/${cadeira.id}`)).body.trabalhos.find((x) => x.id === t.id).entrega, null)

    // docente: cada linha mostra o grupo; corrige uma vez
    const lista = (await portal('prof').get(`/api/portal/trabalhos/${t.id}/entregas`)).body
    const linhaAna = lista.linhas.find((l) => l.estudante.id === contas.ana.id)
    assert.deepEqual([linhaAna.grupo.nome, linhaAna.entrega.id], ['Grupo A', e.body.id])
    assert.equal(lista.linhas.find((l) => l.estudante.id === contas.dino.id).entrega.id, e.body.id)
    assert.equal((await portal('prof').put(`/api/portal/entregas/${e.body.id}`).send({ nota: 16 })).status, 200)
    for (const k of ['ana', 'dino']) {
      assert.equal((await portal(k).get(`/api/portal/cadeiras/${cadeira.id}`)).body.trabalhos.find((x) => x.id === t.id).entrega.nota, 16)
      const n = (await portal(k).get('/api/portal/notificacoes')).body
      assert.ok((n.lista || n).some((x) => x.tipo === 'correcao'))
    }
    // depois de corrigida, o grupo já não substitui
    assert.equal((await portal('ana').post(`/api/portal/trabalhos/${t.id}/entrega`).attach('ficheiro', ...anexo('v3.pdf'))).status, 409)
    // progresso: feito para os dois
    for (const k of ['ana', 'dino']) {
      const p = (await portal(k).get(`/api/portal/cadeiras/${cadeira.id}/progresso`)).body
      assert.equal(p.itens.find((i) => i.tipo === 'trabalho' && i.id === t.id).feita, true)
    }
    // a nota entra na pauta dos dois membros (componente calculada)
    await portal('prof').put(`/api/portal/cadeiras/${cadeira.id}/pauta/composicao`).send({ componente: 'p1', itens: [{ tipo: 'trabalho', id: t.id, peso: 100 }] })
    const pauta = (await portal('prof').get(`/api/portal/cadeiras/${cadeira.id}/pauta`)).body
    const nota = (id) => pauta.linhas.find((l) => l.estudante.id === id).p1
    assert.deepEqual([nota(contas.ana.id), nota(contas.dino.id), nota(contas.carla.id)], [16, 16, null])

    // não se muda para individual com entregas; não se apaga um grupo que entregou
    assert.equal((await portal('prof').put(`/api/portal/trabalhos/${t.id}`).send({ emGrupo: false })).status, 409)
    assert.equal((await portal('prof').delete(`/api/portal/grupos/${A.id}`)).status, 409)
    assert.equal((await portal('prof').delete(`/api/portal/grupos/${B.id}`)).status, 204)
    // sem grupo, não se entrega um trabalho em grupo
    const r = await portal('carla').post(`/api/portal/trabalhos/${t.id}/entrega`).attach('ficheiro', ...anexo('x.pdf'))
    assert.equal(r.status, 409)
    assert.match(r.body.erro, /nenhum grupo/)
  })
})
