import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente } from '../apoio/ambiente.js'

/*
  O ano lectivo nasce aberto (lançam-se as notas e as actividades). Fechado, já não se altera nada dele — turmas,
  cadeiras, matrículas, notas, actividades no portal — nem se emitem documentos (certificados). Reabre-se por ordem
  do Comandante: ele reabre directamente; a Administração Escolar pede (para actividades ou para um documento) e só
  reabre quando ele aprova; se recusar, ela vê o motivo.
*/
describe('Ano lectivo fechado e reaberto por ordem do Comandante', () => {
  let amb, ensino, comandante, turma, cadeira
  const ANO = '2025-2026'
  const decidir = (corpo) => comandante.post(`/api/admin/publicacoes/ano_letivo/${encodeURIComponent('2025/2026')}/decisao`).send(corpo)
  const ano = async () => (await ensino.get('/api/admin/academico/anos-letivos').expect(200)).body.find((a) => a.id === '2025/2026')

  before(async () => {
    amb = await criarAmbiente({ env: { APROVACAO_COMANDANTE: 'sim' } })
    const admin = await amb.entrar()
    await amb.com(admin).post('/api/admin/colecoes/cursos').send({ nome: 'Curso de Estado-Maior' })
    ensino = amb.com((await amb.criarUtilizador('administrador')).token)
    comandante = amb.com((await amb.oComandante()).token)
    turma = (await ensino.post('/api/admin/academico/turmas').send({ curso: 'curso-de-estado-maior', anoLetivo: '2025/2026', nome: 'CEM Fechado' }).expect(201)).body
    cadeira = (await ensino.post(`/api/admin/academico/turmas/${turma.id}/cadeiras`).send({ codigo: 'FEC101', nome: 'Estratégia' })).body
  })
  after(() => amb.fechar())

  it('nasce aberto; fechado, nada desse ano se altera', async () => {
    assert.equal((await ano()).fechado, false)
    const anos = (await ensino.post(`/api/admin/academico/anos-letivos/${ANO}/fechar`).expect(200)).body
    assert.equal(anos.find((a) => a.id === '2025/2026').fechado, true)
    assert.equal((await ensino.post(`/api/admin/academico/anos-letivos/${ANO}/fechar`)).status, 409)
    const r = await ensino.post(`/api/admin/academico/turmas/${turma.id}/cadeiras`).send({ codigo: 'FEC102', nome: 'Outra' })
    assert.equal(r.status, 409)
    assert.match(r.body.erro, /ano lectivo 2025\/2026 está fechado/)
    assert.equal((await ensino.put(`/api/admin/academico/cadeiras/${cadeira.id}`).send({ nome: 'Mudada' })).status, 409)
    assert.equal((await ensino.post('/api/admin/academico/turmas').send({ curso: 'curso-de-estado-maior', anoLetivo: '2025/2026', nome: 'CEM Nova' })).status, 409)
    // consultar continua
    await ensino.get(`/api/admin/academico/turmas/${turma.id}`).expect(200)
    // outro ano (aberto) não é afectado
    await ensino.post('/api/admin/academico/turmas').send({ curso: 'curso-de-estado-maior', anoLetivo: '2026/2027', nome: 'CEM Aberta' }).expect(201)
  })

  it('a Administração Escolar pede a reabertura; o Comandante recusa (com motivo) e depois aprova', async () => {
    assert.equal((await ensino.post(`/api/admin/academico/anos-letivos/${ANO}/reabrir`).send({ motivo: '', finalidade: 'documento' })).status, 400)
    assert.equal((await ensino.post(`/api/admin/academico/anos-letivos/${ANO}/reabrir`).send({ motivo: 'Pedido do estudante', finalidade: 'documento' })).status, 400)
    const p = (await ensino.post(`/api/admin/academico/anos-letivos/${ANO}/reabrir`).send({ motivo: 'Pedido do estudante', finalidade: 'documento', documento: 'Certificado de curso' }).expect(200)).body
    assert.equal(p.reaberto, false)
    assert.equal((await ano()).fechado, true)
    // o Ensino não decide
    assert.equal((await ensino.post(`/api/admin/publicacoes/ano_letivo/${encodeURIComponent('2025/2026')}/decisao`).send({ decisao: 'aprovar' })).status, 403)
    const item = (await comandante.get('/api/admin/publicacoes').expect(200)).body.find((x) => x.colecao === 'ano_letivo')
    assert.match(item.titulo, /Reabrir o ano lectivo 2025\/2026 para emitir um documento/)
    assert.match(item.resumo, /Certificado de curso/)
    assert.equal((await decidir({ decisao: 'recusar' })).status, 400)
    await decidir({ decisao: 'recusar', motivo: 'Falta o requerimento' }).expect(200)
    const a = await ano()
    assert.deepEqual([a.fechado, a.pedidoReabertura, a.recusaReabertura.motivoRecusa], [true, null, 'Falta o requerimento'])
    await ensino.post(`/api/admin/academico/anos-letivos/${ANO}/reabrir`).send({ motivo: 'Nota em falta', finalidade: 'actividades' }).expect(200)
    await decidir({ decisao: 'aprovar' }).expect(200)
    const b = await ano()
    assert.deepEqual([b.fechado, b.reabertura.finalidade, b.recusaReabertura], [false, 'actividades', null])
    await ensino.put(`/api/admin/academico/cadeiras/${cadeira.id}`).send({ nome: 'Estratégia Geral' }).expect(200)
  })

  it('o Comandante fecha e reabre directamente', async () => {
    await comandante.post(`/api/admin/academico/anos-letivos/${ANO}/fechar`).expect(200)
    const r = (await comandante.post(`/api/admin/academico/anos-letivos/${ANO}/reabrir`).send({ motivo: 'Ordem do Comandante' }).expect(200)).body
    assert.equal(r.reaberto, true)
    assert.equal((await ano()).reabertura.autorizadoPor.length > 0, true)
  })
})
