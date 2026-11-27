import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente } from '../apoio/ambiente.js'

// os docentes das legendas dos horários do arquivo: o sistema procura-os nas fichas e a Repartição confirma
describe('Docentes dos horários do arquivo', () => {
  let amb, rae, t
  const docente = (nome, posto, n) => amb.contentor.prisma.contaPortal.create({ data: { tipo: 'docente', numero: `DH-${n}`, nome, email: `dh${n}@esgfaa.gov.ao`, senha: 'x', dados: { posto } } })
  before(async () => {
    amb = await criarAmbiente()
    const tudo = amb.com((await amb.criarUtilizador('administrador')).token)
    rae = amb.com((await amb.criarUtilizador('secretaria')).token)
    await amb.com(await amb.entrar()).post('/api/admin/colecoes/cursos').send({ nome: 'Curso Superior de Comando e Direcção' })
    t = (await tudo.post('/api/admin/academico/turmas').send({ curso: 'curso-superior-de-comando-e-direccao', anoLetivo: '2025/2026', nome: '31.º Curso Superior de Comando e Direcção' })).body
    await tudo.post(`/api/admin/academico/turmas/${t.id}/cadeiras`).send({ codigo: 'LE', nome: 'Liderança Estratégica', horas: 30 }).expect(201)
    await tudo.post(`/api/admin/academico/turmas/${t.id}/cadeiras`).send({ codigo: 'OE', nome: 'Operações de Estabilização', horas: 40 }).expect(201)
    await docente('Horácio Manuel Neto', 'Tenente-General', 1)
    await docente('António Hamilton Kapango', 'Coronel', 2)
    await docente('Paulo Hamilton Silva', 'Major', 3)
    // a carga inicial guarda a folha dos horários
    await amb.contentor.servicos.administracaoEscolar.docentesHorarios.guardar({ actor: { id: null } }, { linhas: [
      { anoLetivo: '2025/2026', curso: '31.º CURSO SUPERIOR DE COMANDO E DIRECÇÃO (CSCD)', sigla: 'LE', cadeira: 'Liderança Estratégia', texto: '1-T.General-Horácio Neto', nomes: ['T.General-Horácio Neto'] },
      { anoLetivo: '2025/2026', curso: '31.º CURSO SUPERIOR DE COMANDO E DIRECÇÃO (CSCD)', sigla: 'OE', cadeira: 'Operações de Estabilização', texto: '1-Coronel-Hamilton kapango/Cor-Fulano', nomes: ['Cor-Hamilton', 'Cor-Inexistente'] },
    ] })
  })
  after(() => amb.fechar())

  it('sugere o docente certo (pelo apelido e pelo posto) e a Repartição confirma', async () => {
    const d = (await rae.get('/api/admin/academico/arquivo/docentes-horarios').expect(200)).body
    assert.equal(d.cadeiras.length, 2)
    const le = d.cadeiras.find((c) => c.codigo === 'LE')
    assert.equal(le.sugestoes[0].candidatos[0].nome, 'Horácio Manuel Neto')
    const oe = d.cadeiras.find((c) => c.codigo === 'OE')
    const ham = oe.sugestoes.find((s) => s.texto === 'Cor-Hamilton')
    assert.deepEqual(ham.candidatos.map((x) => x.nome), ['António Hamilton Kapango'])
    assert.equal(oe.sugestoes.find((s) => s.texto === 'Cor-Inexistente').candidatos.length, 0)
    const r = (await rae.post('/api/admin/academico/arquivo/docentes-horarios').send({ escolhas: [{ cadeiraId: le.cadeiraId, docenteId: le.sugestoes[0].sugerido }, { cadeiraId: oe.cadeiraId, docenteId: ham.sugerido }] }).expect(200)).body
    assert.equal(r.feitas, 2)
    assert.equal(r.cadeiras.find((c) => c.codigo === 'LE').atuais[0].nome, 'Horácio Manuel Neto')
    // repetir não duplica; quem só vê não confirma
    assert.equal((await rae.post('/api/admin/academico/arquivo/docentes-horarios').send({ escolhas: [{ cadeiraId: le.cadeiraId, docenteId: le.sugestoes[0].sugerido }] }).expect(200)).body.feitas, 0)
    const ve = amb.com((await amb.criarUtilizador('director_ensino')).token)
    assert.equal((await ve.post('/api/admin/academico/arquivo/docentes-horarios').send({ escolhas: [{ cadeiraId: le.cadeiraId, docenteId: 1 }] })).status, 403)
  })
})
