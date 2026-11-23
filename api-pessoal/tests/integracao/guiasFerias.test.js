import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente, militar } from '../apoio/ambiente.js'

/*
  Plano de férias → guias prontas: quando chega o mês, cada pessoa do plano desse mês fica com a guia de férias
  emitida (início no dia 1), a licença registada e a saída no expediente; depois imprimem-se todas de uma vez.
*/
describe('Guias de férias do mês, prontas a imprimir', () => {
  let amb, adm
  const h = new Date('2026-10-17T10:00:00Z') // o relógio dos testes
  const ano = h.getFullYear()
  const mes = h.getMonth() + 1
  const seguinte = new Date(ano, h.getMonth() + 1, 1)
  before(async () => {
    amb = await criarAmbiente({ hoje: h.toISOString() })
    adm = amb.com(await amb.entrar())
  })
  after(() => amb.fechar())

  it('o mês chega: as guias do plano preparam-se sozinhas (uma vez), com a licença e o expediente', async () => {
    const a = (await adm.post('/api/pessoas').send(militar({ nome: 'Capitão Férias Um', nip: 'NIPFER1' })).expect(201)).body
    const b = (await adm.post('/api/pessoas').send(militar({ nome: 'Capitão Férias Dois', nip: 'NIPFER2' })).expect(201)).body
    const c = (await adm.post('/api/pessoas').send(militar({ nome: 'Capitão Férias Três', nip: 'NIPFER3' })).expect(201)).body
    await adm.put('/api/plano-ferias').send({ ano, pessoaId: a.id, mes }).expect(200)
    await adm.put('/api/plano-ferias').send({ ano, pessoaId: b.id, mes }).expect(200)
    await adm.put('/api/plano-ferias').send({ ano: seguinte.getFullYear(), pessoaId: c.id, mes: seguinte.getMonth() + 1 }).expect(200)
    const r = await amb.contentor.servicos.planoFerias.prepararDoMesAtual()
    assert.deepEqual(r, { preparadas: 2, erros: [] })
    assert.deepEqual(await amb.contentor.servicos.planoFerias.prepararDoMesAtual(), { preparadas: 0, erros: [] })
    const l = (await adm.get(`/api/plano-ferias/guias?ano=${ano}&mes=${mes}`).expect(200)).body.linhas
    assert.deepEqual(l.map((x) => [x.pessoa.nome, x.guia?.dados.inicio, x.guia?.dados.dias, x.guia?.impressoes]), [
      ['Capitão Férias Dois', `${ano}-${String(mes).padStart(2, '0')}-01`, 30, 0],
      ['Capitão Férias Um', `${ano}-${String(mes).padStart(2, '0')}-01`, 30, 0],
    ])
    assert.equal(await amb.contentor.bd.licenca.count({ where: { pessoaId: a.id, tipo: 'ferias' } }), 1)
    assert.ok(await amb.contentor.bd.expediente.findFirst({ where: { assunto: { contains: 'Capitão Férias Um' }, sentido: 'saida' } }))
    // imprimir todas: ficam como impressas
    await adm.post('/api/declaracoes/impressoes').send({ ids: l.map((x) => x.guia.id) }).expect(200)
    const depois = (await adm.get(`/api/plano-ferias/guias?ano=${ano}&mes=${mes}`).expect(200)).body.linhas
    assert.ok(depois.every((x) => x.guia.impressoes === 1))
    // o militar vem levantar a guia: regista-se o dia (não pode ser depois de hoje; vazio apaga)
    const g = depois[0].guia.id
    await adm.put(`/api/plano-ferias/guias/${g}/levantamento`).send({ data: '2026-10-16' }).expect(200)
    assert.equal((await adm.put(`/api/plano-ferias/guias/${g}/levantamento`).send({ data: '2026-12-01' })).status, 400)
    let x = (await adm.get(`/api/plano-ferias/guias?ano=${ano}&mes=${mes}`).expect(200)).body.linhas.find((y) => y.guia.id === g)
    assert.deepEqual([x.guia.levantadaEm, Boolean(x.guia.levantadaPor)], ['2026-10-16', true])
    await adm.put(`/api/plano-ferias/guias/${g}/levantamento`).send({ data: null }).expect(200)
    x = (await adm.get(`/api/plano-ferias/guias?ano=${ano}&mes=${mes}`).expect(200)).body.linhas.find((y) => y.guia.id === g)
    assert.equal(x.guia.levantadaEm, null)
  })

  it('o mês seguinte ainda não chegou: «Preparar já» emite as que faltam', async () => {
    const q = `ano=${seguinte.getFullYear()}&mes=${seguinte.getMonth() + 1}`
    assert.equal((await adm.get(`/api/plano-ferias/guias?${q}`).expect(200)).body.linhas[0].guia, null)
    const r = (await adm.post('/api/plano-ferias/guias').send({ ano: seguinte.getFullYear(), mes: seguinte.getMonth() + 1 }).expect(200)).body
    assert.equal(r.preparadas, 1)
    assert.ok((await adm.get(`/api/plano-ferias/guias?${q}`).expect(200)).body.linhas[0].guia)
  })

  it('imprimir quando o militar vem levantar: regista o dia, as férias começam nesse dia e o fim recalcula-se', async () => {
    const p = (await adm.post('/api/pessoas').send(militar({ nome: 'Capitão Férias Quatro', nip: 'NIPFER4' })).expect(201)).body
    await adm.put('/api/plano-ferias').send({ ano, pessoaId: p.id, mes }).expect(200)
    await amb.contentor.servicos.planoFerias.prepararDoMesAtual()
    const linha = async () => (await adm.get(`/api/plano-ferias/guias?ano=${ano}&mes=${mes}`).expect(200)).body.linhas.find((x) => x.pessoa.id === p.id)
    const g = (await linha()).guia
    assert.equal(g.dados.inicio, '2026-10-01')
    const r = (await adm.post('/api/plano-ferias/guias/imprimir').send({ ids: [g.id] }).expect(200)).body
    // o relógio dos testes está a 17/10: 30 dias de 17/10 a 15/11
    assert.deepEqual([r[0].dados.inicio, r[0].dados.fim, r[0].dados.data], ['2026-10-17', '2026-11-15', '2026-10-17'])
    const depois = (await linha()).guia
    assert.deepEqual([depois.impressoes, depois.levantadaEm, depois.dados.fim], [1, '2026-10-17', '2026-11-15'])
    const li = await amb.contentor.bd.licenca.findMany({ where: { pessoaId: p.id, tipo: 'ferias' } })
    assert.deepEqual(li.map((x) => [x.inicio.toISOString().slice(0, 10), x.fim.toISOString().slice(0, 10)]), [['2026-10-17', '2026-11-15']])
    // uma cópia depois não muda as datas; a guia continua no mês do plano
    const copia = (await adm.post('/api/plano-ferias/guias/imprimir').send({ ids: [g.id] }).expect(200)).body
    assert.equal(copia[0].dados.inicio, '2026-10-17')
    assert.equal((await linha()).guia.impressoes, 2)
    assert.equal((await adm.post('/api/plano-ferias/guias/imprimir').send({ ids: [999999] })).status, 404)
  })
})
