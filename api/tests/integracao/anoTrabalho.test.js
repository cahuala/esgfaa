import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente } from '../apoio/ambiente.js'

// o ano lectivo com que cada utilizador trabalha: por omissão o actual; escolhe-se na conta e fica lá guardado
describe('Ano lectivo de trabalho de cada conta do painel', () => {
  let amb, adm
  before(async () => {
    amb = await criarAmbiente()
    adm = amb.com(await amb.entrar())
    const p = amb.contentor.prisma
    for (const id of ['2024/2025', '2025/2026']) {
      const [a, b] = id.split('/').map(Number)
      await p.anoLetivo.upsert({ where: { id }, update: {}, create: { id, inicio: new Date(`${a}-10-01`), fim: new Date(`${b}-07-31`), semestre1Inicio: new Date(`${a}-10-01`), semestre1Fim: new Date(`${b}-02-28`), semestre2Inicio: new Date(`${b}-03-01`), semestre2Fim: new Date(`${b}-07-31`), atual: id === '2025/2026' } })
    }
    const t1 = await p.turma.create({ data: { curso: 'x', anoLetivo: '2024/2025', nome: 'T antiga' } })
    const t2 = await p.turma.create({ data: { curso: 'x', anoLetivo: '2025/2026', nome: 'T actual' } })
    const conta = (nome, email) => p.contaPortal.create({ data: { tipo: 'estudante', numero: `E-${email}`, nome, email: `${email}@esgfaa.gov.ao`, senha: 'x' } })
    const antiga = await conta('Estudante do Ano Antigo', 'antigo')
    const actual = await conta('Estudante do Ano Actual', 'actual')
    await conta('Estudante Ainda Sem Turma', 'semturma')
    await p.matricula.create({ data: { estudanteId: antiga.id, turmaId: t1.id } })
    await p.matricula.create({ data: { estudanteId: actual.id, turmaId: t2.id } })
  })
  after(() => amb.fechar())

  it('vazio = o actual; muda-se na conta (só para um ano configurado) e volta-se ao actual', async () => {
    assert.equal((await adm.get('/api/admin/eu').expect(200)).body.anoTrabalho, '')
    assert.equal((await adm.put('/api/admin/eu/ano-trabalho').send({ anoTrabalho: '2024/2025' }).expect(200)).body.anoTrabalho, '2024/2025')
    assert.equal((await adm.get('/api/admin/eu').expect(200)).body.anoTrabalho, '2024/2025')
    assert.equal((await adm.put('/api/admin/eu/ano-trabalho').send({ anoTrabalho: '1999/2000' })).status, 400)
    assert.equal((await adm.put('/api/admin/eu/ano-trabalho').send({ anoTrabalho: '' }).expect(200)).body.anoTrabalho, '')
  })

  it('o registo e o painel mostram os do ano (e, no ano actual, quem ainda não tem turma)', async () => {
    const nomes = async (ano) => (await adm.get(`/api/admin/academico/contas?tipo=estudante&anoLetivo=${encodeURIComponent(ano)}`).expect(200)).body.map((c) => c.nome).sort()
    assert.deepEqual(await nomes('2025/2026'), ['Estudante Ainda Sem Turma', 'Estudante do Ano Actual'])
    // um ano que já passou mostra só quem lá esteve
    assert.deepEqual(await nomes('2024/2025'), ['Estudante do Ano Antigo'])
    const r = (await adm.get('/api/admin/academico/pendentes?anoLetivo=2024%2F2025').expect(200)).body
    assert.deepEqual([r.turmas, r.estudantes, r.anoLetivo], [1, 1, '2024/2025'])
  })
})
