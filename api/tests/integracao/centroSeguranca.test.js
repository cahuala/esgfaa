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

  it('defesa activa: no reforçado, palavras-passe erradas seguidas bloqueiam o endereço', async () => {
    assert.equal((await amb.com(admin).put('/api/admin/seguranca/protecao').send({ nivel: 'reforcado', motivo: 'Teste' })).status, 200)
    const atacante = de('198.51.100.66')
    for (let i = 0; i < 16; i++) await atacante.post('/api/admin/entrar').send({ email: 'ninguem@teste.ao', senha: 'errada123456' })
    assert.equal((await atacante.get('/api/publico/conteudo')).body.codigo, 'bloqueado')
    await amb.com(admin).delete('/api/admin/seguranca/bloqueios/198.51.100.66').expect(204)
  })

  it('defesa activa: emergência fecha o portal e os formulários; isolamento fecha tudo menos o Centro de segurança', async () => {
    const visitante = de('198.51.100.70')
    let r = await amb.com(admin).put('/api/admin/seguranca/protecao').send({ nivel: 'emergencia', motivo: 'Ataque em curso (teste)' })
    assert.equal(r.status, 200, r.body.erro)
    assert.ok(r.body.fechados.includes('portal') && !r.body.fechados.includes('sitePublico'))
    const portal = await visitante.post('/api/portal/entrar').send({ email: 'x@y.ao', senha: 'qualquer123' })
    assert.equal(portal.status, 503)
    assert.equal(portal.body.codigo, 'servico_fechado')
    assert.equal((await visitante.post('/api/publico/contactos').send({})).status, 503)
    assert.equal((await visitante.get('/api/publico/conteudo')).status, 200) // o site continua a ler
    assert.equal((await amb.com(admin).get('/api/admin/utilizadores')).status, 503) // o painel fica só para a segurança
    assert.equal((await amb.com(admin).get('/api/admin/seguranca')).status, 200)

    await amb.com(admin).put('/api/admin/seguranca/protecao').send({ nivel: 'isolamento' }).expect(200)
    assert.equal((await visitante.get('/api/publico/conteudo')).status, 503)
    assert.equal((await de('198.51.100.70').get('/api/saude')).status, 200)
    // os endereços de confiança passam (ex.: a rede da Escola)
    await amb.com(admin).put('/api/admin/seguranca/protecao').send({ confianca: ['198.51.100.0/24'] }).expect(200)
    assert.equal((await visitante.get('/api/publico/conteudo')).status, 200)
    assert.equal((await amb.com(admin).put('/api/admin/seguranca/protecao').send({ confianca: ['rede-errada'] })).status, 400)

    // um serviço desligado à mão, no nível normal
    r = (await amb.com(admin).put('/api/admin/seguranca/protecao').send({ nivel: 'normal', confianca: [], desligados: ['ficheiros'] }).expect(200)).body
    assert.deepEqual(r.fechados, ['ficheiros'])
    assert.equal((await visitante.get('/uploads/qualquer.png')).status, 503)
    assert.equal((await visitante.post('/api/portal/entrar').send({ email: 'x@y.ao', senha: 'qualquer123' })).status !== 503, true)
    await amb.com(admin).put('/api/admin/seguranca/protecao').send({ desligados: [] }).expect(200)
    // fica registado e só quem gere a segurança muda o nível
    const red = await amb.criarUtilizador('redator')
    assert.equal((await amb.com(red.token).put('/api/admin/seguranca/protecao').send({ nivel: 'isolamento' })).status, 403)
    assert.equal((await amb.com(admin).get('/api/admin/seguranca')).body.protecao.nivel, 'normal')
  })

  it('ataques no conteúdo: SQL na entrada é recusado, sqlmap fica bloqueado, phishing não entra, robôs de IA fora do portal', async () => {
    const atacante = (ip) => ({ post: (u) => amb.http().post(u).set('X-Forwarded-For', ip), get: (u, ua) => amb.http().get(u).set('X-Forwarded-For', ip).set('User-Agent', ua || 'Mozilla/5.0') })
    const sql = await atacante('203.0.113.120').post('/api/portal/entrar').send({ email: "admin' OR '1'='1", senha: 'x' })
    assert.equal(sql.status, 400)
    assert.equal(sql.body.codigo, 'conteudo_recusado')
    const ferramenta = await atacante('203.0.113.121').get('/api/publico/conteudo', 'sqlmap/1.7.2#stable (https://sqlmap.org)')
    assert.equal(ferramenta.status, 403)
    assert.equal((await atacante('203.0.113.121').get('/api/saude')).body.codigo, 'bloqueado') // fica logo bloqueado
    const ph = await atacante('203.0.113.122').post('/api/publico/contactos').send({ nome: 'X', email: 'x@y.ao', assunto: 'Outro assunto', mensagem: 'A sua conta será bloqueada, confirme os seus dados em http://esgfaa-gov-ao.login.com' })
    assert.equal(ph.status, 400)
    assert.equal(ph.body.codigo, 'phishing')
    assert.equal((await atacante('192.0.2.140').get('/api/portal/eu', 'Mozilla/5.0 (compatible; GPTBot/1.1)')).status, 403)
    assert.equal((await atacante('192.0.2.140').get('/api/publico/conteudo', 'Mozilla/5.0 (compatible; GPTBot/1.1)')).status, 200) // no site, só se a Escola quiser
    await amb.com(admin).put('/api/admin/seguranca/protecao').send({ bloquearRobosIA: true }).expect(200)
    assert.equal((await atacante('192.0.2.140').get('/api/publico/conteudo', 'Mozilla/5.0 (compatible; GPTBot/1.1)')).status, 403)
    await amb.com(admin).put('/api/admin/seguranca/protecao').send({ bloquearRobosIA: false }).expect(200)
    // quem já entrou pode escrever texto que cite código (fica só registado)
    assert.notEqual((await amb.com(admin).post('/api/admin/colecoes/noticias').send({ titulo: 'Guia: o que é um ataque <script>', resumo: "O ataque ' OR '1'='1 explicado", data: '2026-10-01', categoria: 'Institucional', conteudo: [] })).status, 400)
    const r = (await amb.com(admin).get('/api/admin/seguranca')).body
    for (const t of ['injecao_corpo', 'ferramenta_ataque', 'phishing', 'robo_ia']) assert.ok(r.ultimos5[t] >= 1, t)
    await amb.com(admin).delete('/api/admin/seguranca/bloqueios/203.0.113.121').expect(204)
  })

  it('simular um ataque enche o painel e bloqueia os endereços de documentação, sem mudar o nível', async () => {
    assert.equal((await amb.com((await amb.criarUtilizador('redator')).token).post('/api/admin/seguranca/simular')).status, 403)
    await amb.com(admin).post('/api/admin/seguranca/simular').expect(200)
    const r = (await amb.com(admin).get('/api/admin/seguranca')).body
    for (const t of ['login_falhado', 'sondagem', 'injecao', 'injecao_corpo', 'phishing', 'ferramenta_ataque', 'robo_ia', 'injecao_ia']) assert.ok(r.ultimos5[t] >= 1, t)
    assert.ok(r.bloqueios.some((b) => b.ip === '203.0.113.10' && /Simulação/.test(b.motivo)))
    assert.equal(r.protecao.nivel, 'normal')
    for (const b of r.bloqueios) await amb.com(admin).delete(`/api/admin/seguranca/bloqueios/${b.ip}`)
  })
})
