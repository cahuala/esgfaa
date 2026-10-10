import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente } from '../apoio/ambiente.js'

describe('proteções HTTP', () => {
  let amb
  before(async () => { amb = await criarAmbiente() })
  after(() => amb.fechar())

  it('cabeçalhos de segurança e sem X-Powered-By', async () => {
    const r = await amb.http().get('/api/saude')
    assert.equal(r.status, 200)
    assert.equal(r.headers['x-content-type-options'], 'nosniff')
    assert.equal(r.headers['x-frame-options'], 'SAMEORIGIN')
    assert.match(r.headers['content-security-policy'], /default-src 'none'/)
    assert.equal(r.headers['x-powered-by'], undefined)
    assert.match(r.headers['x-request-id'], /^[0-9a-f-]{36}$/)
  })

  it('reaproveita um X-Request-Id válido e ignora valores perigosos', async () => {
    assert.equal((await amb.http().get('/api/saude').set('X-Request-Id', 'pedido-12345678')).headers['x-request-id'], 'pedido-12345678')
    assert.notEqual((await amb.http().get('/api/saude').set('X-Request-Id', '<script>')).headers['x-request-id'], '<script>')
  })

  it('CORS só para as origens autorizadas', async () => {
    const ok = await amb.http().get('/api/publico/conteudo').set('Origin', 'https://cahuala.github.io')
    assert.equal(ok.headers['access-control-allow-origin'], 'https://cahuala.github.io')
    const mau = await amb.http().get('/api/publico/conteudo').set('Origin', 'https://site-malicioso.com')
    assert.equal(mau.headers['access-control-allow-origin'], undefined)
  })

  it('respostas do painel não ficam em cache', async () => {
    const r = await amb.http().post('/api/admin/entrar').send({ email: 'a@b.ao', senha: 'x' })
    assert.equal(r.headers['cache-control'], 'no-store')
  })

  it('erros sempre em JSON { erro }, sem detalhes internos', async () => {
    const nada = await amb.http().get('/api/nada')
    assert.equal(nada.status, 404)
    assert.equal(nada.body.erro, 'Endereço não encontrado.')

    const mal = await amb.http().post('/api/admin/entrar').set('Content-Type', 'application/json').send('{"email": ')
    assert.equal(mal.status, 400)
    assert.equal(mal.body.erro, 'Pedido mal formado.')
    assert.doesNotMatch(JSON.stringify(mal.body), /at |node_modules|SyntaxError/)
  })

  it('recusa corpos demasiado grandes (413)', async () => {
    const r = await amb.http().post('/api/publico/visita').send({ caminho: 'x'.repeat(3 * 1024 * 1024) })
    assert.equal(r.status, 413)
  })

  it('erro inesperado responde 500 genérico com o id do pedido', async () => {
    const original = amb.contentor.servicos.conteudos.todosPublicados
    amb.contentor.servicos.conteudos.todosPublicados = () => { throw new Error('falha secreta da base de dados') }
    try {
      const r = await amb.http().get('/api/publico/conteudo')
      assert.equal(r.status, 500)
      assert.equal(r.body.erro, 'Erro interno do servidor.')
      assert.doesNotMatch(JSON.stringify(r.body), /secreta/)
      assert.equal(r.body.pedido, r.headers['x-request-id'])
      assert.equal(amb.erros.length, 1)
    } finally {
      amb.contentor.servicos.conteudos.todosPublicados = original
    }
  })

  it('SQL injection em parâmetros e filtros não tem efeito', async () => {
    const t = await amb.entrar()
    const r = await amb.com(t).get("/api/admin/atividades?acao=entrar' OR '1'='1&q=') ; DROP TABLE utilizadores; --")
    assert.equal(r.status, 200)
    assert.equal(r.body.total, 0)
    assert.equal((await amb.com(t).get('/api/admin/utilizadores')).status, 200)
  })
})
