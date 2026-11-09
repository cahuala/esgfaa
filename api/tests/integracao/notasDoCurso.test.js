import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente, relogioFalso } from '../apoio/ambiente.js'

const NOVA = 'Portal2026segura'
const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n')
const comoPdf = (pedido) => pedido.attach('ficheiro', PDF, { filename: 'plano.pdf', contentType: 'application/pdf' })

// o plano do curso e o programa em PDF, as datas das provas, o período de lançamento e as notas publicadas
describe('cursos da ESG: documentos, datas, período de lançamento e notas publicadas', () => {
  let amb, relogio, admin, comandante, turma, uc, plano, tai, prof, ana, outraConta
  const notas = (cliente, base, nota, id = tai.id) => cliente.put(`${base}/cadeiras/${uc.id}/provas/${id}/notas`).send({ linhas: [{ estudanteId: ana.id, nota }] })

  async function entrarPortal(email) {
    const inicial = amb.senhaInicial(email)
    const r = await amb.http().post('/api/portal/entrar').send({ email, senha: inicial })
    return amb.com((await amb.com(r.body.token).put('/api/portal/eu/senha').send({ atual: inicial, nova: NOVA })).body.token)
  }

  before(async () => {
    relogio = relogioFalso('2026-11-10T09:00:00Z')
    amb = await criarAmbiente({ relogio })
    await amb.com(await amb.entrar()).post('/api/admin/colecoes/cursos').send({ nome: 'Curso de Teste' })
    admin = amb.com((await amb.criarUtilizador('administrador')).token)
    comandante = amb.com((await amb.criarUtilizador('comandante')).token)
    turma = (await admin.post('/api/admin/academico/turmas').send({ curso: 'curso-de-teste', anoLetivo: '2026/2027', nome: 'Teste A' })).body
    const docente = (await admin.post('/api/admin/academico/contas').send({ tipo: 'docente', nome: 'Docente Prof Teste', email: 'prof@esgfaa.gov.ao' })).body
    ana = (await amb.registarEMatricular(admin, turma.id, { nome: 'Discente Ana Teste', email: 'ana@esgfaa.gov.ao' })).body
    plano = (await admin.post('/api/admin/academico/planos-curso').send({ curso: 'curso-de-teste', anoLetivo: '2026/2027', nome: 'Plano de teste', formula: 'media', blocos: [] }).expect(201)).body
    uc = (await admin.post(`/api/admin/academico/turmas/${turma.id}/cadeiras`).send({ codigo: 'UC1', nome: 'Unidade de teste', horasContacto: 30, horasNaoContacto: 15, creditos: 3 })).body
    await admin.put(`/api/admin/academico/cadeiras/${uc.id}/docentes`).send({ docentes: [{ docenteId: docente.id, papel: 'regente' }] })
    tai = (await admin.post(`/api/admin/academico/cadeiras/${uc.id}/provas`).send({ tipo: 'TAI', forma: 'teste', titulo: 'Teste 1', data: '2026-11-20' }).expect(201)).body.avaliacoes[0]
    prof = await entrarPortal('prof@esgfaa.gov.ao')
    outraConta = (await amb.registarEMatricular(admin, (await admin.post('/api/admin/academico/turmas').send({ curso: 'curso-de-teste', anoLetivo: '2025/2026', nome: 'Outra' })).body.id, { nome: 'Discente Bruno Teste', email: 'bruno@esgfaa.gov.ao' })).body
  })
  after(() => amb.fechar())

  it('o PDF do plano do curso só o abre quem está no curso e ano lectivo', async () => {
    assert.equal((await comoPdf(comandante.put(`/api/admin/academico/planos-curso/${plano.id}/documento`))).status, 403)
    const p = await comoPdf(admin.put(`/api/admin/academico/planos-curso/${plano.id}/documento`))
    assert.equal(p.status, 200, p.body.erro)
    assert.ok(p.body.ficheiroId)
    const estudante = await entrarPortal('ana@esgfaa.gov.ao')
    assert.equal((await estudante.get(`/api/portal/ficheiros/${p.body.ficheiroId}`)).status, 200)
    assert.equal((await prof.get(`/api/portal/ficheiros/${p.body.ficheiroId}`)).status, 200)
    // outra edição do curso: não abre
    assert.ok(outraConta.id)
    const bruno = await entrarPortal('bruno@esgfaa.gov.ao')
    assert.equal((await bruno.get(`/api/portal/ficheiros/${p.body.ficheiroId}`)).status, 404)
  })

  it('o docente envia o programa da sua disciplina em PDF; o estudante não', async () => {
    const r = await comoPdf(prof.put(`/api/portal/cadeiras/${uc.id}/programa`))
    assert.equal(r.status, 200, r.body.erro)
    const palavra = await prof.put(`/api/portal/cadeiras/${uc.id}/programa`).attach('ficheiro', Buffer.from('PK\x03\x04conteudo'), { filename: 'p.docx', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
    assert.equal(palavra.status, 400)
    const estudante = amb.com((await amb.http().post('/api/portal/entrar').send({ email: 'ana@esgfaa.gov.ao', senha: NOVA })).body.token)
    assert.notEqual((await comoPdf(estudante.put(`/api/portal/cadeiras/${uc.id}/programa`))).status, 200)
  })

  it('a data da prova aparece no calendário', async () => {
    const l = (await prof.get('/api/portal/calendario?de=2026-11-01&ate=2026-11-30').expect(200)).body
    assert.ok(l.some((e) => e.data === '2026-11-20' && e.titulo === 'TAI: Teste 1'))
  })

  it('período de lançamento: fora dele o docente não lança o TAI; a Administração Escolar sim', async () => {
    await admin.post('/api/admin/academico/prazos-notas').send({ componente: 'TAI', inicio: '2026-11-01', fim: '2026-11-05' }).expect(201)
    const r = await notas(prof, '/api/portal', 12)
    assert.equal(r.status, 403)
    assert.match(r.body.erro, /prazo de lançamento dos TAI/)
    await admin.post('/api/admin/academico/prazos-notas').send({ componente: 'TAI', inicio: '2026-11-06', fim: '2026-11-30', cadeiraId: uc.id }).expect(201)
    assert.equal((await notas(prof, '/api/portal', 12)).status, 200)
    assert.equal((await prof.get(`/api/portal/cadeiras/${uc.id}/pauta`)).body.prazos.TAI.aberto, true)
  })

  it('nota publicada: nem o docente nem o administrador a mudam sem o Comandante; com a autorização, mesmo fora do prazo', async () => {
    await admin.put(`/api/admin/academico/cadeiras/${uc.id}/provas/${tai.id}/publicacao`).send({ publicar: true }).expect(200)
    assert.equal((await notas(prof, '/api/portal', 15)).status, 409)
    assert.equal((await notas(admin, '/api/admin/academico', 15)).status, 409)
    assert.equal((await admin.put(`/api/admin/academico/cadeiras/${uc.id}/provas/${tai.id}/publicacao`).send({ publicar: false })).status, 409)
    // o administrador do sistema já não autoriza
    await prof.post(`/api/portal/cadeiras/${uc.id}/alteracoes-notas`).send({ avaliacaoId: tai.id, estudanteIds: [ana.id], motivo: 'Erro de soma na correcção da prova.' }).expect(201)
    const pedido = (await comandante.get('/api/admin/academico/alteracoes-notas?estado=pendente')).body[0]
    assert.equal((await admin.post('/api/admin/academico/alteracoes-notas/decidir').send({ ids: [pedido.id], decisao: 'autorizar' })).status, 403)
    await comandante.post('/api/admin/academico/alteracoes-notas/decidir').send({ ids: [pedido.id], decisao: 'autorizar' }).expect(200)
    relogio.avancar(40 * 24 * 60) // o período já fechou
    assert.equal((await notas(prof, '/api/portal', 15)).status, 200)
    // a autorização gasta-se
    assert.equal((await notas(prof, '/api/portal', 16)).status, 409)
    // o próprio Comandante pode corrigir no painel
    assert.equal((await notas(comandante, '/api/admin/academico', 14)).status, 200)
  })
})

describe('modelos dos planos 2026/2027', () => {
  it('todas as UC são anuais: os planos organizam por blocos, não por semestres', async () => {
    const { MODELOS_PLANO } = await import('../../src/dominio/academico/avaliacao/planoCurso.js')
    for (const m of Object.values(MODELOS_PLANO)) assert.ok(m.cadeiras.every((c) => c.periodo === 'anual'))
  })
})
