import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente, relogioFalso } from '../apoio/ambiente.js'

const base = (extra = {}) => ({
  curso: 'curso-de-estado-maior',
  nome: 'João Manuel Fernandes',
  dataNascimento: '1985-04-20',
  bi: '004512345LA041',
  email: 'joao.fernandes@faa.ao',
  telefone: '+244 923 456 789',
  provincia: 'Luanda',
  ramo: 'Exército',
  posto: 'Major',
  nip: '19870123',
  unidade: 'Estado-Maior General',
  anosServico: 15,
  habilitacoes: 'Licenciatura',
  motivacao: 'Pretendo aprofundar a minha preparação para funções de planeamento e comando.',
  declaracao: true,
  consentimento: true,
  ...extra,
})

describe('candidaturas', () => {
  let amb, admin
  before(async () => {
    amb = await criarAmbiente({ relogio: relogioFalso('2026-10-11T12:00:00Z') })
    admin = await amb.entrar()
    await amb.com(admin).post('/api/admin/colecoes/cursos').send({ nome: 'Curso de Estado-Maior' })
    await amb.com(admin).post('/api/admin/colecoes/cursos').send({ nome: 'Curso em preparação', _estado: 'rascunho' })
  })
  after(() => amb.fechar())
  const enviar = (corpo) => amb.http().post('/api/publico/candidaturas').send(corpo)

  it('regista a candidatura e devolve o código de acompanhamento', async () => {
    const r = await enviar(base())
    assert.equal(r.status, 201)
    assert.match(r.body.codigo, /^ESG-2026-[A-Z2-9]{6}$/)
    assert.equal(r.body.curso, 'curso-de-estado-maior')
    // não devolve dados pessoais sensíveis
    assert.ok(!('dados' in r.body))
  })

  it('não aceita a mesma pessoa duas vezes no mesmo curso enquanto está em análise', async () => {
    const r = await enviar(base())
    assert.equal(r.status, 409)
  })

  it('valida e indica o campo com erro; cursos em rascunho não aceitam candidaturas', async () => {
    const r = await enviar(base({ email: 'outro@faa.ao', telefone: 'xx' }))
    assert.equal(r.status, 400)
    assert.match(r.body.erro, /telefone/i)
    assert.equal((await enviar(base({ email: 'outro@faa.ao', curso: 'curso-em-preparacao' }))).status, 400)
  })

  it('robôs (campo escondido preenchido) não criam candidaturas', async () => {
    const r = await enviar(base({ email: 'robo@spam.com', website: 'http://spam' }))
    assert.equal(r.status, 204)
    const lista = (await amb.com(admin).get('/api/admin/candidaturas')).body.lista
    assert.ok(!lista.some((c) => c.email === 'robo@spam.com'))
  })

  it('HTML no texto fica guardado como texto (o painel escapa ao mostrar)', async () => {
    const r = await enviar(base({ email: 'xss@faa.ao', motivacao: '<img src=x onerror=alert(1)> quero mesmo muito fazer este curso de estado-maior' }))
    assert.equal(r.status, 201)
  })

  it('a lista exige permissão; a Secretaria vê e avalia', async () => {
    assert.equal((await amb.http().get('/api/admin/candidaturas')).status, 401)
    const redator = await amb.criarUtilizador('redator')
    assert.equal((await amb.com(redator.token).get('/api/admin/candidaturas')).status, 403)

    const secretaria = await amb.criarUtilizador('secretaria')
    const r = await amb.com(secretaria.token).get('/api/admin/candidaturas?q=joao.fernandes')
    assert.equal(r.status, 200)
    assert.equal(r.body.lista.length, 1)
    assert.equal(r.body.porEstado.recebida, 2)
    const c = r.body.lista[0]
    assert.equal(c.dados.posto, 'Major')

    const av = await amb.com(secretaria.token).put(`/api/admin/candidaturas/${c.id}`).send({ estado: 'admitida', notas: 'Documentos conferidos.' })
    assert.equal(av.status, 200)
    assert.equal(av.body.estado, 'admitida')
    assert.equal((await amb.com(secretaria.token).put(`/api/admin/candidaturas/${c.id}`).send({ estado: 'inventado' })).status, 400)
    assert.equal((await amb.com(secretaria.token).get('/api/admin/candidaturas/99999')).status, 404)

    // decidida, a pessoa pode voltar a candidatar-se ao mesmo curso noutro ano
    assert.equal((await enviar(base())).status, 201)

    const log = await amb.contentor.repositorios.atividades.listar({ acao: 'avaliar_candidatura' })
    assert.equal(log.total, 1)
  })

  it('limita candidaturas seguidas do mesmo endereço (429)', async () => {
    const lim = await criarAmbiente({ limites: { candidatura: { maximo: 2 } } })
    try {
      for (let i = 0; i < 2; i++) await lim.http().post('/api/publico/candidaturas').send(base({ email: `a${i}@faa.ao` }))
      assert.equal((await lim.http().post('/api/publico/candidaturas').send(base({ email: 'a9@faa.ao' }))).status, 429)
    } finally {
      await lim.fechar()
    }
  })
})
