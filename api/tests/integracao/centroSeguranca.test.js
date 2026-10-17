import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente } from '../apoio/ambiente.js'

describe('Centro de segurança: estado do servidor, ataques ao vivo e bloqueios', () => {
  let amb, admin
  // o endereço de quem pede vem do proxy (como em produção)
  const de = (ip) => ({ get: (u) => amb.http().get(u).set('X-Forwarded-For', ip), post: (u) => amb.http().post(u).set('X-Forwarded-For', ip) })
  before(async () => {
    amb = await criarAmbiente({ env: { TRUST_PROXY: '1' } })
    admin = await amb.entrar()
  })
  after(() => amb.fechar())

  it('só para quem tem permissão; mostra a saúde do servidor e da base de dados', async () => {
    const red = await amb.criarUtilizador('redator')
    assert.equal((await amb.com(red.token).get('/api/admin/seguranca')).status, 403)
    const r = await amb.com(admin).get('/api/admin/seguranca')
    assert.equal(r.status, 200, r.body.erro)
    assert.equal(r.body.saude.baseDados.ligada, true)
    assert.ok(r.body.saude.memoria.total > 0 && r.body.saude.processador.nucleos > 0)
    assert.equal(r.body.serie.length, 60)
    assert.ok(['normal', 'atencao', 'ataque'].includes(r.body.alerta.nivel))
  })

  it('conta as palavras-passe erradas e mostra-as no fluxo ao vivo', async () => {
    for (let i = 0; i < 3; i++) await de('198.51.100.20').post('/api/admin/entrar').send({ email: 'ninguem@teste.ao', senha: 'errada123456' })
    const r = (await amb.com(admin).get('/api/admin/seguranca')).body
    assert.ok(r.ultimos5.login_falhado >= 3)
    assert.ok(r.recentes.some((e) => e.tipo === 'login_falhado' && e.ip === '198.51.100.20'))
    assert.ok(r.ipsAtivos.some((x) => x.ip === '198.51.100.20' && x.eventos.login_falhado >= 3))
  })

  it('um robô que procura falhas fica bloqueado sozinho; o administrador desbloqueia', async () => {
    const robo = de('203.0.113.9')
    for (const c of ['/.env', '/.git/config', '/wp-login.php', '/phpmyadmin/', '/backup.sql']) for (let i = 0; i < 4; i++) await robo.get(c)
    const b = await robo.get('/api/publico/conteudo')
    assert.equal(b.status, 403)
    assert.equal(b.body.codigo, 'bloqueado')
    assert.equal((await de('203.0.113.50').get('/api/saude')).status, 200) // os outros continuam
    const r = (await amb.com(admin).get('/api/admin/seguranca')).body
    const bl = r.bloqueios.find((x) => x.ip === '203.0.113.9')
    assert.ok(bl && bl.automatico)
    assert.ok(r.ultimos5.sondagem >= 20)
    assert.equal((await amb.com(admin).delete('/api/admin/seguranca/bloqueios/203.0.113.9')).status, 204)
    assert.equal((await robo.get('/api/saude')).status, 200)
  })

  it('bloqueio à mão: valida o endereço e não deixa bloquear o próprio', async () => {
    assert.equal((await amb.com(admin).post('/api/admin/seguranca/bloqueios').send({ ip: 'isto-nao-e-ip' })).status, 400)
    const r = await amb.com(admin).post('/api/admin/seguranca/bloqueios').send({ ip: '192.0.2.77', horas: 2, motivo: 'Teste' })
    assert.equal(r.status, 201, r.body.erro)
    assert.equal((await de('192.0.2.77').get('/api/saude')).status, 403)
    const proprio = await amb.http().post('/api/admin/seguranca/bloqueios').set('Authorization', `Bearer ${admin}`).set('X-Forwarded-For', '192.0.2.88').send({ ip: '192.0.2.88' })
    assert.equal(proprio.status, 400)
  })
})
