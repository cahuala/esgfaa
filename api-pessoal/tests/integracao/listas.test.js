import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente } from '../apoio/ambiente.js'

describe('listas do sistema (Configurações)', () => {
  let amb, adm
  before(async () => {
    amb = await criarAmbiente()
    adm = amb.com(await amb.entrar())
  })
  after(() => amb.fechar())

  it('mostra as listas e as de origem', async () => {
    const l = (await adm.get('/api/listas').expect(200)).body
    const c = l.find((x) => x.id === 'categoriasDocente')
    assert.equal(c.mudada, false)
    assert.ok(c.valor.includes('Assistente estagiário'))
    assert.ok(l.find((x) => x.id === 'tiposUnidade').fixas.includes('departamento'))
  })

  it('uma categoria nova passa a valer na ficha e nas referências', async () => {
    await adm.post('/api/pessoas').send({ tipo: 'civil', vinculo: 'docente', nome: 'Docente Categoria Nova', categoriaDocente: 'Professor titular' }).expect(400)
    const c = (await adm.put('/api/listas/categoriasDocente').send({ valor: ['Assistente estagiário', 'Assistente', 'Professor auxiliar', 'Professor associado', 'Professor catedrático', 'Professor titular'] }).expect(200)).body
    assert.equal(c.mudada, true)
    await adm.post('/api/pessoas').send({ tipo: 'civil', vinculo: 'docente', nome: 'Docente Categoria Nova', categoriaDocente: 'Professor titular' }).expect(201)
    assert.ok((await adm.get('/api/referencias').expect(200)).body.categoriasDocente.includes('Professor titular'))
    // repor: volta a de origem
    const r = (await adm.post('/api/listas/categoriasDocente/repor').expect(200)).body
    assert.equal(r.mudada, false)
  })

  it('listas com código: muda-se o nome, acrescenta-se, mas as de origem não se tiram', async () => {
    const atual = (await adm.get('/api/listas')).body.find((x) => x.id === 'tiposUnidade').valor
    const { departamento, ...sem } = atual
    void departamento
    await adm.put('/api/listas/tiposUnidade').send({ valor: sem }).expect(400)
    await adm.put('/api/listas/tiposUnidade').send({ valor: { ...atual, 'mau código': 'X' } }).expect(400)
    await adm.put('/api/listas/tiposUnidade').send({ valor: { ...atual, departamento: 'Departamento de Ensino', escola: 'Escola' } }).expect(200)
    const u = (await adm.post('/api/unidades').send({ nome: 'Escola de Línguas', tipo: 'escola' }).expect(201)).body
    assert.equal(u.tipo, 'escola')
    const { escola } = (await adm.get('/api/organica').expect(200)).body
    const achar = (l) => l.flatMap((n) => [n, ...achar(n.filhos ?? [])])
    assert.equal(achar([escola]).find((n) => n.id === u.id)?.tipoNome, 'Escola')
  })

  it('texto repetido ou lista vazia não', async () => {
    await adm.put('/api/listas/provincias').send({ valor: ['Luanda', 'luanda'] }).expect(400)
    await adm.put('/api/listas/provincias').send({ valor: [] }).expect(400)
    await adm.put('/api/listas/naoExiste').send({ valor: ['x'] }).expect(404)
  })

  it('só o administrador muda as listas', async () => {
    await amb.criarConta(adm, { nome: 'Operador Listas', email: 'operador.listas@esgfaa.gov.ao', papel: 'operador', senha: 'Operador#Listas2026' })
    const t = await amb.entrar('operador.listas@esgfaa.gov.ao', 'Operador#Listas2026')
    const m = await amb.com(t).post('/api/mudar-senha').send({ atual: 'Operador#Listas2026', nova: 'Operador#Listas2027' }).expect(200)
    const op = amb.com(m.body.token ?? t)
    await op.get('/api/listas').expect(200)
    await op.put('/api/listas/provincias').send({ valor: ['Luanda'] }).expect(403)
  })
})
