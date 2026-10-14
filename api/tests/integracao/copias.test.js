import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente, relogioFalso } from '../apoio/ambiente.js'
import { anosEntre } from '../../src/aplicacao/academico/partilhado/copias.js'

const NOVA = 'Portal2026segura'
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n')

describe('novo ano letivo: copiar cadeiras e importar conteúdos', () => {
  let amb, sec, antiga, turmaNova, origem
  const contas = {}
  const tokens = {}
  const portal = (quem) => amb.com(tokens[quem])

  before(async () => {
    amb = await criarAmbiente({ relogio: relogioFalso('2025-10-01T09:00:00Z') })
    const admin = await amb.entrar()
    await amb.com(admin).post('/api/admin/colecoes/cursos').send({ nome: 'Curso de Estado-Maior' })
    const s = await amb.criarUtilizador('secretaria')
    sec = () => amb.com(s.token)
    antiga = (await sec().post('/api/admin/academico/turmas').send({ curso: 'curso-de-estado-maior', anoLetivo: '2025/2026', nome: 'CEM 2025' })).body
    turmaNova = (await sec().post('/api/admin/academico/turmas').send({ curso: 'curso-de-estado-maior', anoLetivo: '2026/2027', nome: 'CEM 2026' })).body
    for (const k of ['prof', 'prof2']) contas[k] = (await sec().post('/api/admin/academico/contas').send({ tipo: 'docente', nome: `Docente ${k} Teste`, email: `${k}@esgfaa.gov.ao` })).body
    contas.velho = (await sec().post(`/api/admin/academico/turmas/${antiga.id}/matricula-nova`).send({ nome: 'Estudante Antigo Teste', email: 'velho@esgfaa.gov.ao' })).body
    contas.ana = (await sec().post(`/api/admin/academico/turmas/${turmaNova.id}/matricula-nova`).send({ nome: 'Estudante Ana Teste', email: 'ana@esgfaa.gov.ao' })).body
    origem = (await sec().post(`/api/admin/academico/turmas/${antiga.id}/cadeiras`).send({ codigo: 'EST101', nome: 'Estratégia', periodo: 'anual', horas: 90 })).body
    await sec().put(`/api/admin/academico/cadeiras/${origem.id}/docentes`).send({ docentes: [{ docenteId: contas.prof.id, papel: 'regente', horas: 90 }] })
    await sec().put(`/api/admin/academico/cadeiras/${origem.id}/programa`).send({ texto: '<p>Objetivos do curso.</p>' })
    for (const k of ['prof', 'prof2', 'velho', 'ana']) {
      const email = `${k}@esgfaa.gov.ao`
      const r = await amb.http().post('/api/portal/entrar').send({ email, senha: email })
      tokens[k] = (await amb.com(r.body.token).put('/api/portal/eu/senha').send({ atual: email, nova: NOVA })).body.token
    }

    // conteúdos de 2025/2026
    const cap = (await portal('prof').post(`/api/portal/cadeiras/${origem.id}/secoes`).send({ titulo: 'Capítulo 1', resumo: 'Teoria.' })).body
    const m = await portal('prof').post(`/api/portal/cadeiras/${origem.id}/materiais`).field('titulo', 'Sebenta').field('tipo', 'ficheiro').field('secaoId', String(cap.id))
      .attach('ficheiro', PDF, { filename: 'sebenta.pdf', contentType: 'application/pdf' })
    assert.equal(m.status, 201, m.body.erro)
    const t = (await portal('prof').post(`/api/portal/cadeiras/${origem.id}/trabalhos`).send({ titulo: 'Ensaio', prazo: '2025-11-20T23:59:00Z', secaoId: cap.id })).body
    const q = (await portal('prof').post(`/api/portal/cadeiras/${origem.id}/questionarios`).send({ titulo: 'Teste', fecha: '2025-11-25T23:59:00Z', secaoId: cap.id })).body
    await portal('prof').post(`/api/portal/questionarios/${q.id}/perguntas`).send({ tipo: 'vf', enunciado: 'Pergunta de teste?', correta: 'verdadeiro' })
    await portal('prof').put(`/api/portal/questionarios/${q.id}`).send({ publicado: true })
    await portal('prof').post(`/api/portal/cadeiras/${origem.id}/eventos`).send({ tipo: 'p1', data: '2025-11-10', inicio: '08:00' })
    await portal('prof').put(`/api/portal/cadeiras/${origem.id}/pauta/composicao`).send({ componente: 'p1', itens: [{ tipo: 'trabalho', id: t.id, peso: 70 }, { tipo: 'questionario', id: q.id, peso: 30 }] })
    await portal('prof').put('/api/portal/atividades/restricoes').send({ tipo: 'questionario', id: q.id, disponivelDe: '2025-11-01T08:00:00Z', requisitos: [{ tipo: 'material', id: m.body.id }, { tipo: 'trabalho', id: t.id, notaMinima: 10 }] })
    // o que não se copia: entregas e fórum
    await portal('velho').post(`/api/portal/trabalhos/${t.id}/entrega`).attach('ficheiro', PDF, { filename: 'e.pdf', contentType: 'application/pdf' })
    await portal('velho').post(`/api/portal/cadeiras/${origem.id}/forum`).send({ titulo: 'Dúvida antiga', texto: 'Olá' })
  })
  after(() => amb.fechar())

  it('anos entre anos letivos', () => {
    assert.equal(anosEntre('2025/2026', '2026/2027'), 1)
    assert.equal(anosEntre('2024/2025', '2026/2027'), 2)
    assert.equal(anosEntre('x', '2026/2027'), 0)
  })

  it('copiar a turma: cria as cadeiras, copia os conteúdos com as datas um ano à frente e ficheiros próprios', async () => {
    const r = await sec().post(`/api/admin/academico/turmas/${turmaNova.id}/copiar`).send({ origemTurmaId: antiga.id, docentes: true })
    assert.equal(r.status, 200, r.body.erro)
    const [linha] = r.body.cadeiras
    assert.deepEqual([linha.codigo, linha.criada, linha.copiada, linha.capitulos, linha.materiais, linha.trabalhos, linha.questionarios, linha.datas, linha.docentes, linha.anos], ['EST101', true, true, 1, 1, 1, 1, 1, 1, 1])

    const nova = (await sec().get(`/api/admin/academico/turmas/${turmaNova.id}`)).body.cadeiras.find((c) => c.codigo === 'EST101')
    assert.deepEqual([nova.periodo, nova.horas, nova.docentes[0].id], ['anual', 90, contas.prof.id])
    const v = (await portal('ana').get(`/api/portal/cadeiras/${nova.id}`)).body
    assert.deepEqual(v.secoes.map((s) => [s.titulo, s.resumo]), [['Capítulo 1', 'Teoria.']])
    assert.equal(v.programa, '<p>Objetivos do curso.</p>')
    assert.equal(v.trabalhos[0].prazo, '2026-11-20T23:59:00.000Z')
    assert.equal(v.trabalhos[0].secaoId, v.secoes[0].id)
    assert.equal(v.trabalhos[0].entrega, null) // as entregas não vêm
    assert.equal(v.questionarios[0].fecha, '2026-11-25T23:59:00.000Z')
    assert.equal(v.eventos[0].data, '2026-11-10')
    assert.equal(v.forum.topicos, 0)

    // o ficheiro é uma cópia: a estudante nova abre-o, mas não o da turma antiga
    const fNovo = v.materiais[0].ficheiroId
    assert.equal((await portal('ana').get(`/api/portal/ficheiros/${fNovo}`)).status, 200)
    const fAntigo = (await portal('velho').get(`/api/portal/cadeiras/${origem.id}`)).body.materiais[0].ficheiroId
    assert.notEqual(fNovo, fAntigo)
    assert.equal((await portal('ana').get(`/api/portal/ficheiros/${fAntigo}`)).status, 404)

    // a composição da 1.ª prova aponta para as atividades novas
    const pauta = (await portal('prof').get(`/api/portal/cadeiras/${nova.id}/pauta`)).body
    assert.deepEqual(pauta.composicoes.p1.map((i) => [i.tipo, i.id, i.peso]), [['trabalho', v.trabalhos[0].id, 70], ['questionario', v.questionarios[0].id, 30]])

    // as restrições vêm com a data um ano à frente e as condições sobre as atividades novas
    const qp = (await portal('prof').get(`/api/portal/cadeiras/${nova.id}`)).body.questionarios[0]
    assert.equal(qp.disponivelDe, '2026-11-01T08:00:00.000Z')
    assert.deepEqual(qp.requisitos, [{ tipo: 'material', id: v.materiais[0].id, notaMinima: null }, { tipo: 'trabalho', id: v.trabalhos[0].id, notaMinima: 10 }])

    // repetir não duplica
    const outra = await sec().post(`/api/admin/academico/turmas/${turmaNova.id}/copiar`).send({ origemTurmaId: antiga.id })
    assert.deepEqual(outra.body.cadeiras.map((c) => [c.copiada, c.motivo]), [[false, 'já tinha conteúdos']])
    assert.equal((await portal('prof').post(`/api/portal/cadeiras/${nova.id}/importar`).send({ origemId: nova.id })).status, 400)
  })

  it('o docente importa de outra cadeira sua; não de cadeiras de outros', async () => {
    const vazia = (await sec().post(`/api/admin/academico/turmas/${turmaNova.id}/cadeiras`).send({ codigo: 'EST102', nome: 'Estratégia II' })).body
    await sec().put(`/api/admin/academico/cadeiras/${vazia.id}/docentes`).send({ docentes: [{ docenteId: contas.prof.id, papel: 'regente' }, { docenteId: contas.prof2.id, papel: 'assistente' }] })
    assert.equal((await portal('prof2').post(`/api/portal/cadeiras/${vazia.id}/importar`).send({ origemId: origem.id })).status, 404)
    assert.equal((await portal('ana').post(`/api/portal/cadeiras/${vazia.id}/importar`).send({ origemId: origem.id })).status, 403)
    const r = await portal('prof').post(`/api/portal/cadeiras/${vazia.id}/importar`).send({ origemId: origem.id })
    assert.equal(r.status, 200, r.body.erro)
    assert.deepEqual([r.body.capitulos, r.body.materiais, r.body.docentes], [1, 1, 0])
  })
})
