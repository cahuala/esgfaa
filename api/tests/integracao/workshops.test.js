import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente, relogioFalso } from '../apoio/ambiente.js'
import { distribuirAvaliacoes } from '../../src/dominio/academico/workshops.js'

const NOVA = 'Portal2026segura'
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n')
const NOMES = ['ana', 'bruno', 'carla', 'dino']

describe('avaliação por pares (workshop)', () => {
  let amb, relogio, cadeira, w
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

  it('distribuição: ninguém se avalia a si; cada trabalho recebe n avaliações', () => {
    const p = distribuirAvaliacoes([1, 2, 3, 4], 2, () => 0.3)
    assert.equal(p.length, 8)
    assert.ok(p.every((x) => x.autorId !== x.avaliadorId))
    for (const id of [1, 2, 3, 4]) {
      assert.equal(p.filter((x) => x.autorId === id).length, 2)
      assert.equal(p.filter((x) => x.avaliadorId === id).length, 2)
    }
    assert.equal(distribuirAvaliacoes([1, 2], 5).length, 2) // no máximo n - 1
    assert.deepEqual(distribuirAvaliacoes([1], 3), [])
  })

  it('entrega, avaliação anónima entre pares, nota e pauta', async () => {
    const criar = (corpo) => portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/workshops`).send({ titulo: 'Plano de operação', fimSubmissao: '2026-11-15T23:59:00Z', fimAvaliacao: '2026-11-22T23:59:00Z', ...corpo })
    assert.equal((await criar({ grelha: [] })).status, 400)
    assert.equal((await criar({ grelha: [{ criterio: 'Clareza', pontos: 10 }], fimAvaliacao: '2026-11-10T00:00:00Z' })).status, 400)
    w = (await criar({ grelha: [{ criterio: 'Análise da missão', pontos: 10 }, { criterio: 'Modalidades de ação', pontos: 10 }], avaliacoesPorPar: 2 })).body
    assert.equal(w.avaliacoesPorPar, 2)
    assert.equal((await portal('ana').get(`/api/portal/cadeiras/${cadeira.id}`)).body.workshops[0].fase, 'submissao')

    // entregas: ana, bruno e carla; dino não entrega
    assert.equal((await portal('ana').post(`/api/portal/workshops/${w.id}/submissao`).send({})).status, 400)
    const fa = await portal('ana').post(`/api/portal/workshops/${w.id}/submissao`).field('texto', 'Plano da Ana').attach('ficheiro', PDF, { filename: 'plano-ana.pdf', contentType: 'application/pdf' })
    assert.equal(fa.status, 201, fa.body.erro)
    await portal('bruno').post(`/api/portal/workshops/${w.id}/submissao`).send({ texto: 'Plano do Bruno' })
    await portal('carla').post(`/api/portal/workshops/${w.id}/submissao`).send({ texto: 'Plano da Carla' })
    const ficheiroAna = fa.body.ficheiro.id
    assert.equal((await portal('bruno').get(`/api/portal/ficheiros/${ficheiroAna}`)).status, 404) // ainda não lhe calhou
    let v = (await portal('ana').get(`/api/portal/workshops/${w.id}`)).body
    assert.deepEqual([v.fase, v.avaliacoes.length, v.minha.texto], ['submissao', 0, 'Plano da Ana'])

    // fim da entrega: distribuição automática na primeira visita
    relogio.avancar(60 * 24 * 7)
    assert.equal((await portal('dino').post(`/api/portal/workshops/${w.id}/submissao`).send({ texto: 'Tarde' })).status, 409)
    v = (await portal('ana').get(`/api/portal/workshops/${w.id}`)).body
    assert.equal(v.fase, 'avaliacao')
    assert.equal(v.avaliacoes.length, 2)
    assert.ok(v.avaliacoes.every((a) => a.submissao.estudante === null)) // anónimo
    assert.ok(!v.avaliacoes.some((a) => a.submissao.texto === 'Plano da Ana'))
    assert.equal((await portal('dino').get(`/api/portal/workshops/${w.id}`)).body.avaliacoes.length, 0) // quem não entregou não avalia

    // todos avaliam: cada um dá 15 (8 + 7) e à Ana 20
    for (const k of ['ana', 'bruno', 'carla']) {
      const lista = (await portal(k).get(`/api/portal/workshops/${w.id}`)).body.avaliacoes
      for (const a of lista) {
        const ana = a.submissao.texto === 'Plano da Ana'
        assert.equal((await portal(k).put(`/api/portal/avaliacoes-pares/${a.id}`).send({ pontos: { 0: 8 } })).status, 400) // falta um critério
        const r = await portal(k).put(`/api/portal/avaliacoes-pares/${a.id}`).send({ pontos: ana ? { 0: 10, 1: 10 } : { 0: 8, 1: 7 }, comentario: ana ? 'Excelente.' : 'Bom.' })
        assert.equal(r.status, 200, r.body.erro)
        if (ana) assert.equal((await portal(k).get(`/api/portal/ficheiros/${ficheiroAna}`)).status, 200)
      }
    }
    // a avaliação de outro não se mexe
    const alheia = (await portal('bruno').get(`/api/portal/workshops/${w.id}`)).body.avaliacoes[0]
    assert.equal((await portal('carla').put(`/api/portal/avaliacoes-pares/${alheia.id}`).send({ pontos: { 0: 1, 1: 1 } })).status, 404)

    // docente vê tudo, com nomes e médias
    const d = (await portal('prof').get(`/api/portal/workshops/${w.id}`)).body
    const sAna = d.submissoes.find((s) => s.estudanteId === contas.ana.id)
    assert.deepEqual([sAna.notaPares, sAna.avaliacoes.length, d.semEntrega.map((e) => e.nome)], [20, 2, ['Estudante dino Teste']])
    assert.equal(d.submissoes.find((s) => s.estudanteId === contas.bruno.id).notaPares, 15)
    // o docente corrige a nota do Bruno
    await portal('prof').put(`/api/portal/submissoes-workshop/${d.submissoes.find((s) => s.estudanteId === contas.bruno.id).id}`).send({ nota: 16, comentario: 'Revisto pelo docente.' })

    // conta para a pauta só no fim; quem não entregou fica com 0
    await portal('prof').put(`/api/portal/cadeiras/${cadeira.id}/pauta/composicao`).send({ componente: 'p1', itens: [{ tipo: 'workshop', id: w.id, peso: 100 }] })
    let pauta = (await portal('prof').get(`/api/portal/cadeiras/${cadeira.id}/pauta`)).body
    assert.equal(pauta.linhas.find((l) => l.estudante.id === contas.ana.id).p1, null)
    relogio.avancar(60 * 24 * 8)
    pauta = (await portal('prof').get(`/api/portal/cadeiras/${cadeira.id}/pauta`)).body
    const p1 = (k) => pauta.linhas.find((l) => l.estudante.id === contas[k].id).p1
    assert.deepEqual([p1('ana'), p1('bruno'), p1('carla'), p1('dino')], [20, 16, 15, 0])

    // encerrado: o autor vê as avaliações recebidas, sem quem as fez
    v = (await portal('ana').get(`/api/portal/workshops/${w.id}`)).body
    assert.deepEqual([v.fase, v.nota, v.recebidas.length], ['encerrado', 20, 2])
    assert.ok(v.recebidas.every((r) => r.comentario === 'Excelente.' && r.avaliadorId === undefined))
    assert.equal((await portal('bruno').get(`/api/portal/workshops/${w.id}`)).body.nota, 16)
    const prog = (await portal('ana').get(`/api/portal/cadeiras/${cadeira.id}/progresso`)).body
    assert.equal(prog.itens.find((i) => i.tipo === 'workshop').feita, true)
  })
})
