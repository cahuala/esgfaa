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
})
