import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { RAIZ } from '../../src/config.js'
import { criarAmbiente, militar } from '../apoio/ambiente.js'

// quadro orgânico: a 6.ª Repartição é do Comando; a correcção muda a que ficou na Direcção dos Serviços Gerais
describe('A 6.ª Repartição passa para o Comando', () => {
  let amb
  const u = { email: 'teste', nome: 'Teste', papel: 'administrador' }
  before(async () => { amb = await criarAmbiente() })
  after(() => amb.fechar())

  it('na base que já a tinha nos Serviços Gerais: muda de unidade e de nome, quem lá está fica', async () => {
    await amb.contentor.servicos.organica.importarQuadro(u, { simular: false, linhas: [
      { unidade: 'Comando', tipo: 'Comando', cargo: 'Comandante da Escola Superior de Guerra', funcao: 'Comando', posto: 'General', lugares: '1' },
      { unidade: 'Direcção dos Serviços Gerais', tipo: 'Direcção', cargo: 'Director dos Serviços Gerais da Escola Superior de Guerra', funcao: 'Direcção e Chefia', posto: 'Coronel', lugares: '1' },
      { unidade: '6.ª Repartição', tipo: 'Repartição', superior: 'Direcção dos Serviços Gerais', cargo: 'Chefe da 6.ª Repartição da Direcção dos Serviços Gerais da Escola Superior de Guerra', funcao: 'Direcção e Chefia', posto: 'Major', lugares: '1' },
    ] })
    const bd = amb.contentor.bd
    const cargo = await bd.cargo.findFirst({ where: { nome: { contains: '6.ª Repartição' } } })
    const adm = amb.com(await amb.entrar())
    const p = (await adm.post('/api/pessoas').send(militar({ nome: 'Major Sexta Teste', posto: 'major' })).expect(201)).body
    await bd.pessoa.update({ where: { id: p.id }, data: { cargoId: cargo.id, unidadeId: cargo.unidadeId } })
    const sql = fs.readFileSync(path.join(RAIZ, 'prisma/migrations/20261228090000_sexta_reparticao_no_comando/migration.sql'), 'utf8')
    for (const instrucao of sql.split(';').map((x) => x.replace(/--.*$/gm, '').trim()).filter(Boolean)) await bd.$executeRawUnsafe(instrucao)
    const comando = await bd.unidade.findFirst({ where: { nome: 'Comando' } })
    const sexta = await bd.unidade.findFirst({ where: { nome: '6.ª Repartição' } })
    assert.equal(sexta.paiId, comando.id)
    assert.equal((await bd.cargo.findUnique({ where: { id: cargo.id } })).nome, 'Chefe da 6.ª Repartição da Escola Superior de Guerra')
    const pessoa = await bd.pessoa.findUnique({ where: { id: p.id } })
    assert.deepEqual([pessoa.cargoId, pessoa.unidadeId], [cargo.id, sexta.id])
    // correr outra vez não muda nada
    for (const instrucao of sql.split(';').map((x) => x.replace(/--.*$/gm, '').trim()).filter(Boolean)) await bd.$executeRawUnsafe(instrucao)
    assert.equal((await bd.unidade.findFirst({ where: { nome: '6.ª Repartição' } })).paiId, comando.id)
  })
})
