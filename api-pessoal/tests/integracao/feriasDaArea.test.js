import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente, militar } from '../apoio/ambiente.js'

/*
  Plano de férias por área: o chefe de cada área (o cargo de direcção e chefia da unidade) marca o mês de férias
  de quem trabalha na sua área (e nas subunidades); fica no plano do Pessoal; cada pessoa vê o seu.
*/
describe('Plano de férias feito em cada área', () => {
  let amb, adm, chefe, prof, fora, contaChefe, contaProf
  const u = { email: 'teste', nome: 'Teste', papel: 'administrador' }
  before(async () => {
    amb = await criarAmbiente()
    adm = amb.com(await amb.entrar())
    const s = amb.contentor.servicos
    await s.organica.importarQuadro(u, { simular: false, linhas: [
      { unidade: 'Direcção de Ensino', tipo: 'Direcção', cargo: 'Director de Ensino', funcao: 'Direcção e Chefia', posto: 'Brigadeiro', lugares: '1' },
      { unidade: 'Departamento de Estratégia', tipo: 'Departamento', superior: 'Direcção de Ensino', cargo: 'Chefe do Departamento de Estratégia', funcao: 'Direcção e Chefia', posto: 'Coronel', lugares: '1' },
      { unidade: 'Departamento de Estratégia', tipo: 'Departamento', superior: 'Direcção de Ensino', cargo: 'Professor de Estratégia', funcao: 'Execução', posto: 'Major', lugares: '2' },
      { unidade: 'Repartição de Finanças', tipo: 'Repartição', cargo: 'Chefe da Repartição de Finanças', funcao: 'Direcção e Chefia', posto: 'Coronel', lugares: '1' },
    ] })
    const cargo = async (nome) => amb.contentor.bd.cargo.findFirst({ where: { nome } })
    chefe = (await adm.post('/api/pessoas').send(militar({ nome: 'Coronel Chefe Estrategia', posto: 'coronel' })).expect(201)).body
    prof = (await adm.post('/api/pessoas').send(militar({ nome: 'Major Professor Estrategia', posto: 'major' })).expect(201)).body
    fora = (await adm.post('/api/pessoas').send(militar({ nome: 'Coronel Chefe Financas', posto: 'coronel' })).expect(201)).body
    // os militares entram no cargo por nomeação: aqui põe-se o cargo directamente na ficha
    const colocar = async (p, nome) => { const c = await cargo(nome); await amb.contentor.bd.pessoa.update({ where: { id: p.id }, data: { cargoId: c.id, unidadeId: c.unidadeId } }) }
    await colocar(chefe, 'Chefe do Departamento de Estratégia')
    await colocar(prof, 'Professor de Estratégia')
    await colocar(fora, 'Chefe da Repartição de Finanças')
    const contas = (await adm.post('/api/utilizadores/contas-pessoas').send({ pessoaIds: [chefe.id, prof.id] }).expect(200)).body
    // entra com a palavra-passe inicial e muda-a (como no primeiro acesso)
    const entrar = async (pessoaId) => {
      const c = contas.find((x) => x.pessoaId === pessoaId)
      const t = await amb.entrar(c.entrar, c.senha)
      return amb.com((await amb.com(t).post('/api/mudar-senha').send({ atual: c.senha, nova: 'Ferias-da-Area-2027x' }).expect(200)).body.token)
    }
    contaChefe = await entrar(chefe.id)
    contaProf = await entrar(prof.id)
  })
  after(() => amb.fechar())

  it('o chefe do departamento vê e marca a sua área; fica no plano do Pessoal', async () => {
    const ra = await contaChefe.get('/api/plano-ferias/area?ano=2027'); assert.equal(ra.status, 200, JSON.stringify(ra.body)); const a = ra.body
    assert.equal(a.unidade, 'Departamento de Estratégia')
    assert.deepEqual(a.linhas.map((l) => l.nome).sort(), ['Coronel Chefe Estrategia', 'Major Professor Estrategia'])
    await contaChefe.put('/api/plano-ferias/area').send({ ano: 2027, pessoaId: prof.id, mes: 8 }).expect(200)
    // quem não é da área: não
    assert.equal((await contaChefe.put('/api/plano-ferias/area').send({ ano: 2027, pessoaId: fora.id, mes: 8 })).status, 404)
    const plano = (await adm.get('/api/plano-ferias?ano=2027').expect(200)).body.linhas.find((l) => l.id === prof.id)
    assert.deepEqual([plano.mes, plano.marcadoPor], [8, 'Coronel Chefe Estrategia (Departamento de Estratégia)'])
  })

  it('quem não é chefe não tem plano da área; cada um vê o seu plano', async () => {
    assert.equal((await contaProf.get('/api/plano-ferias/area?ano=2027')).status, 403)
    const meu = (await contaProf.get('/api/eu/plano-ferias').expect(200)).body
    assert.deepEqual(meu.plano.map((x) => [x.ano, x.mesNome]), [[2027, 'agosto']])
    assert.equal(meu.pessoa.dias, 30)
  })
})
